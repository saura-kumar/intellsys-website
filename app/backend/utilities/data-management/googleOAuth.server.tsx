import type {Credentials} from "~/backend/utilities/data-management/credentials.server";
import {storeCredentials} from "~/backend/utilities/data-management/credentials.server";
import type {Uuid} from "~/utilities/typeDefinitions";
import {dataSourcesAbbreviations} from "~/utilities/typeDefinitions";
import {ConnectorTableType, ConnectorType} from "~/utilities/typeDefinitions";
import {CredentialType} from "~/utilities/typeDefinitions";
import {generateUuid} from "~/global-common-typescript/utilities/utilities";
import {
    deleteCompanyIdToConnectorIdMapping,
    deleteCompanyIdToCredentialIdMapping,
    deleteConnectorAndSubconnector,
    getDestinationCredentialId,
    getRedirectUri,
    getSourceAndDestinationId,
    getSystemConnectorsDatabaseManager,
    getSystemPostgresDatabaseManager,
    initializeConnectorAndSubConnector,
    mapCompanyIdToConnectorId,
} from "~/backend/utilities/data-management/common.server";
import {getRequiredEnvironmentVariableNew} from "~/global-common-typescript/server/utilities.server";
import type {Integer} from "~/global-common-typescript/typeDefinitions";
import {getUuidFromUnknown} from "~/global-common-typescript/utilities/typeValidationUtilities";
import type {PostgresDatabaseManager} from "~/global-common-typescript/server/postgresDatabaseManager.server";
import {TransactionCommand, getPostgresDatabaseManager} from "~/global-common-typescript/server/postgresDatabaseManager.server";
import {deleteCredentialFromKms} from "~/global-common-typescript/server/kms.server";
import jwt from "jsonwebtoken";
import {getSingletonValueOrNull} from "~/utilities/utilities";

// TODO: Fix timezone in database

export type AccessibleAccount = {
    customerClientId: string;
    customerClientName: string;
    managerId: string;
    managerName: string;
};

export const googleAdsScope = "https://www.googleapis.com/auth/adwords";

export type GoogleAdsCredentials = {
    refreshToken: string;
    googleAccountId: string;
    googleLoginCustomerId: string;
};

export type GoogleAdsAccessToken = {
    accessToken: string;
};

export type Connector = {
    id: Uuid;
    loginCustomerId: string;
};

export async function getGoogleAdsRefreshToken(authorizationCode: string, companyId: Uuid): Promise<string | Error> {
    const redirectUri = getRedirectUri(companyId, CredentialType.GoogleAds);
    if (redirectUri instanceof Error) {
        return redirectUri;
    }

    // Post api to retrieve access token by giving authorization code.
    const url = `https://oauth2.googleapis.com/token?client_id=${getRequiredEnvironmentVariableNew("GOOGLE_CLIENT_ID")}&client_secret=${getRequiredEnvironmentVariableNew(
        "GOOGLE_CLIENT_SECRET",
    )}&redirect_uri=${redirectUri}&code=${authorizationCode}&grant_type=authorization_code`;

    const response = await fetch(url, {
        method: "POST",
    });
    const rawResponse = await response.json();

    if (rawResponse.refresh_token == undefined) {
        return Error("Refresh token not found");
    }

    return rawResponse.refresh_token;
}

export async function ingestAndStoreGoogleAdsData(credentials: GoogleAdsCredentials, companyId: Uuid, connectorId: Uuid): Promise<void | Error> {
    const response = await storeGoogleAdsOAuthDetails(credentials, companyId, connectorId);
    if (response instanceof Error) {
        return response;
    }
}

/**
 *  Handles the OAuth2 flow to authorize the Google Ads API for the given companyId and stores the credentials in KMS table, connectors table, subconnecter table and companyToConnectorTable
 */
export async function storeGoogleAdsOAuthDetails(credentials: GoogleAdsCredentials, companyId: Uuid, connectorId: Uuid): Promise<void | Error> {
    try {
        console.log(1);
        const sourceCredentialId = generateUuid();

        // Destination = Company's Database.
        const companyDatabaseCredentialId = await getDestinationCredentialId(companyId);
        console.log(2);
        if (companyDatabaseCredentialId instanceof Error) {
            return companyDatabaseCredentialId;
        }

        console.log(3);

        const companyDatabaseManager = await getPostgresDatabaseManager(companyDatabaseCredentialId);
        if (companyDatabaseManager instanceof Error) {
            console.log(4);
            return companyDatabaseManager;
        }

        console.log(5);

        const systemConnectorsDatabaseManager = await getSystemConnectorsDatabaseManager();
        if (systemConnectorsDatabaseManager instanceof Error) {
            return systemConnectorsDatabaseManager;
        }

        console.log(6);

        const systemPostgresDatabaseManager = await getSystemPostgresDatabaseManager();
        if (systemPostgresDatabaseManager instanceof Error) {
            return systemPostgresDatabaseManager;
        }

        console.log(7);

        // Store credentials in KMS.
        const response = await storeCredentials(getUuidFromUnknown(sourceCredentialId), credentials, companyId, CredentialType.GoogleAds);
        if (response instanceof Error) {
            return response;
        }

        console.log(8);

        await systemConnectorsDatabaseManager.executeTransactionCommand(TransactionCommand.Begin);
        await systemPostgresDatabaseManager.executeTransactionCommand(TransactionCommand.Begin);

        const connectorInitializationResponse = await initializeConnectorAndSubConnector(
            systemConnectorsDatabaseManager,
            connectorId,
            sourceCredentialId,
            companyDatabaseCredentialId,
            "Google Ads",
            ConnectorTableType.GoogleAds,
            ConnectorType.GoogleAds,
            `{"loginCustomerId": "${credentials.googleLoginCustomerId}"}`,
        );

        const mapCompanyIdToConnectorIdResponse = await mapCompanyIdToConnectorId(systemPostgresDatabaseManager, companyId, connectorId, ConnectorType.GoogleAds, "Google Ads");

        if (connectorInitializationResponse instanceof Error || mapCompanyIdToConnectorIdResponse instanceof Error) {
            await systemConnectorsDatabaseManager.executeTransactionCommand(TransactionCommand.Rollback);
            await systemPostgresDatabaseManager.executeTransactionCommand(TransactionCommand.Rollback);

            console.log("All transactions rollbacked");
            return connectorInitializationResponse;
        }

        await systemConnectorsDatabaseManager.executeTransactionCommand(TransactionCommand.Commit);
        await systemPostgresDatabaseManager.executeTransactionCommand(TransactionCommand.Commit);

        console.log(9);

        const createTableResponse = await createTable(companyDatabaseManager, credentials);
        if (createTableResponse instanceof Error) {
            return createTableResponse;
        }

        console.log(10);

        const dataIngestionResponse = await ingestGoogleAdsData(getUuidFromUnknown(connectorId), 45);
        if (dataIngestionResponse instanceof Error) {
            return dataIngestionResponse;
        }

        console.log(11);
    } catch (e) {
        console.log(e);
    }
}

export async function getAccessibleAccounts(refreshToken: string): Promise<Array<AccessibleAccount> | Error> {
    var formdata = new FormData();
    formdata.append("developer_token", getRequiredEnvironmentVariableNew("GOOGLE_DEVELOPER_TOKEN"));
    formdata.append("client_id", getRequiredEnvironmentVariableNew("GOOGLE_CLIENT_ID"));
    formdata.append("client_secret", getRequiredEnvironmentVariableNew("GOOGLE_CLIENT_SECRET"));
    formdata.append("refresh_token", refreshToken);

    var requestOptions = {
        method: "POST",
        body: formdata,
    };

    const rawResponse = await fetch(`${process.env.INTELLSYS_GOOGLE_ADS_HELPER_URL}/get_accessible_accounts`, requestOptions);

    if (!rawResponse.ok) {
        return Error("Request to get accessible account failed");
    }

    const response = await rawResponse.json();

    console.log("response", response);
    const accessbileAccounts: Array<AccessibleAccount> = response.map((row) => convertToAccessbileAccount(row));

    return accessbileAccounts;
}

export function convertToAccessbileAccount(row: Credentials) {
    const result: AccessibleAccount = {
        customerClientId: row.customer_client_id as string,
        customerClientName: row.customer_client_name as string,
        managerId: row.manager_id as string,
        managerName: row.manager_name as string,
    };

    return result;
}

export async function createTable(postgresDatabaseManager: PostgresDatabaseManager, googleAdsCredentials: GoogleAdsCredentials): Promise<Error | void> {
    const tableName = `${dataSourcesAbbreviations.googleAds}_${googleAdsCredentials.googleLoginCustomerId}`;

    const response = await postgresDatabaseManager.execute(
        `
            CREATE TABLE ${tableName} (
                id text NOT NULL,
                ingested_at timestamp NOT NULL,
                "data" json NOT NULL,
                CONSTRAINT ${tableName}_pkey PRIMARY KEY (id)
            );
        `,
    );

    if (response instanceof Error) {
        return response;
    }
}

export async function ingestGoogleAdsData(connectorId: Uuid, duration: Integer): Promise<void | Error> {
    const url = `${getRequiredEnvironmentVariableNew("INTELLSYS_CONNECTOR_URL")}/googleads/historical`;

    const body = new FormData();
    body.set("connectorId", connectorId);
    body.set("duration", duration.toString());

    const headers = new Headers();
    headers.append("Authorization", getRequiredEnvironmentVariableNew("INTELLSYS_CONNECTOR_TOKEN"));

    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: body,
        redirect: "follow",
    });

    if (!response.ok) {
        return Error(await response.text());
    }

    const ingestionResult = await response.json();
    console.log(ingestionResult);
}

export async function deleteCredentialsFromSources(connectorId: Uuid, googleAdsLoginCustomerId: string, connectorType: ConnectorType) {
    // TODO: Add transactions

    const connector = await getSourceAndDestinationId(connectorId);
    if (connector instanceof Error) {
        return connector;
    }

    const systemPostgresDatabaseManager = getSystemPostgresDatabaseManager();
    if (systemPostgresDatabaseManager instanceof Error) {
        return systemPostgresDatabaseManager;
    }

    await deleteCompanyIdToCredentialIdMapping(connector.sourceId);

    await deleteCredentialFromKms(connector.sourceId);

    await deleteCompanyIdToConnectorIdMapping(connectorId);
    await deleteConnectorAndSubconnector(connectorId);

    // Delete data from google ads data
    await dropGoogleAdsTable(googleAdsLoginCustomerId, connector.destinationId);
}

export async function dropGoogleAdsTable(accountId: string, destinationDatabaseCredentialId: Uuid) {
    const databaseManager = await getPostgresDatabaseManager(destinationDatabaseCredentialId);
    if (databaseManager instanceof Error) {
        return databaseManager;
    }

    // Change it to DROP
    const query = `
        DROP TABLE ${dataSourcesAbbreviations.googleAds}_${accountId}
    `;

    const response = await databaseManager.execute(query);

    if (response instanceof Error) {
        return response;
    }
}

export async function checkGoogleAdsConnectorExistsForAccount(googleLoginCustomerId: string): Promise<boolean | Error> {
    const connectorDatabaseManager = await getSystemConnectorsDatabaseManager();
    if (connectorDatabaseManager instanceof Error) {
        return connectorDatabaseManager;
    }

    const response = await connectorDatabaseManager.execute(
        `
        SELECT
            *
        FROM
            connectors
        WHERE
            connector_type = $1
            AND
            extra_information->>'loginCustomerId' = $2
    `,
        [ConnectorType.GoogleAds, googleLoginCustomerId],
    );

    const row = getSingletonValueOrNull(response.rows);

    if (row != null) {
        return true;
    }

    return false;
}

export async function getGoogleAdsConnectorsAssociatedWithCompanyId(companyId: Uuid): Promise<Array<Connector> | Error> {
    const systemPostgresDatabaseManager = await getSystemPostgresDatabaseManager();
    if (systemPostgresDatabaseManager instanceof Error) {
        return systemPostgresDatabaseManager;
    }

    const systemConnectorsDatabaseManager = await getSystemConnectorsDatabaseManager();

    if (systemConnectorsDatabaseManager instanceof Error) {
        return systemConnectorsDatabaseManager;
    }

    const connectorIdsResponse = await systemPostgresDatabaseManager.execute(
        `
            SELECT
                connector_id
            FROM
                company_to_connector_mapping
            WHERE
                company_id = $1
        `,
        [companyId],
    );

    if (connectorIdsResponse instanceof Error) {
        return connectorIdsResponse;
    }

    if (connectorIdsResponse.rows.length == 0) {
        return Error("Connector Ids not found!");
    }

    const connectorIds: Array<Uuid> = connectorIdsResponse.rows.map((row) => getUuidFromUnknown(row.connector_id));

    const connectorDetails = await systemConnectorsDatabaseManager.execute(
        `
            SELECT
                id,
                extra_information->>'loginCustomerId' AS loginCustomerId
            FROM
                connectors
            WHERE
                id IN (${connectorIds.map((item) => `'${item}'`).join(", ")})
                AND
                connector_type = $1
        `,
        [ConnectorType.GoogleAds],
    );

    if (connectorDetails instanceof Error) {
        return connectorDetails;
    }

    const result: Array<Connector> = connectorDetails.rows.map((row) => rowToConnector(row));
    return result;
}

function rowToConnector(row: Credentials): Connector {
    const result: Connector = {
        id: getUuidFromUnknown(row.id),
        loginCustomerId: row.logincustomerid as string,
    };
    return result;
}
