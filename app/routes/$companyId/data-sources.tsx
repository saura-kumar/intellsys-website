import type {ActionFunction, LoaderFunction} from "@remix-run/node";
import {json} from "@remix-run/node";
import {redirect} from "@remix-run/node";
import {Form, useLoaderData} from "@remix-run/react";
import {getRedirectUri} from "~/backend/utilities/data-management/common.server";
import {getFacebookAuthorizationCodeUrl} from "~/backend/utilities/data-management/facebookOAuth.server";
import type {Connector} from "~/backend/utilities/data-management/googleOAuth.server";
import {getConnectorsAssociatedWithCompanyId} from "~/backend/utilities/data-management/googleOAuth.server";
import {deleteConnector, googleAdsScope} from "~/backend/utilities/data-management/googleOAuth.server";
import {ItemBuilder} from "~/components/reusableComponents/itemBuilder";
import {SectionHeader} from "~/components/scratchpad";
import {getUuidFromUnknown} from "~/global-common-typescript/utilities/typeValidationUtilities";
import type {Uuid} from "~/utilities/typeDefinitions";
import {ConnectorType, CredentialType} from "~/utilities/typeDefinitions";

type LoaderData = {
    googleAdsConnectors: Array<Connector>;
    facebookAdsConnectors: Array<Connector>;
};

export const action: ActionFunction = async ({request, params}) => {
    const body = await request.formData();
    const companyId = params.companyId;
    if (companyId == null) {
        throw new Response(null, {status: 404});
    }

    const companyIdUuid = getUuidFromUnknown(companyId);

    if (body.get("action") == "facebook") {
        const redirectUri = getRedirectUri(companyIdUuid, CredentialType.FacebookAds);
        if (redirectUri instanceof Error) {
            return "Facebook Ads redirect uri not defined!";
        }

        const authUrl = getFacebookAuthorizationCodeUrl(redirectUri);

        return redirect(authUrl);
    } else if (body.get("action") == "google") {
        const redirectUri = getRedirectUri(companyIdUuid, CredentialType.GoogleAds);
        if (redirectUri instanceof Error) {
            return "Google Ads redirect uri not defined!";
        }

        const url = `https://accounts.google.com/o/oauth2/v2/auth?scope=${googleAdsScope}&client_id=${process.env
            .GOOGLE_CLIENT_ID!}&response_type=code&redirect_uri=${redirectUri}&prompt=consent&access_type=offline&state=${companyId}`;

        return redirect(url);
    } else if (body.get("action") == "deleteGoogleAds") {
        const connectorId = body.get("connectorId") as Uuid;
        const loginCustomerId = body.get("loginCustomerId") as Uuid;

        await deleteConnector(connectorId, loginCustomerId, ConnectorType.GoogleAds);
    }

    return null;
};

export const loader: LoaderFunction = async ({request, params}) => {
    const companyId = params.companyId;
    if (companyId == null) {
        throw new Response(null, {status: 404});
    }

    const companyIdUuid = getUuidFromUnknown(companyId);

    const googleConnectorDetails = await getConnectorsAssociatedWithCompanyId(companyIdUuid, getUuidFromUnknown(ConnectorType.GoogleAds));
    if (googleConnectorDetails instanceof Error) {
        return googleConnectorDetails;
    }

    const facebookConnectorDetails = await getConnectorsAssociatedWithCompanyId(companyIdUuid, getUuidFromUnknown(ConnectorType.FacebookAds));
    if (facebookConnectorDetails instanceof Error) {
        return facebookConnectorDetails;
    }

    const response: LoaderData = {
        googleAdsConnectors: googleConnectorDetails,
        facebookAdsConnectors: facebookConnectorDetails,
    };

    return json(response);
};

export default function () {
    const loaderData = useLoaderData() as LoaderData;

    return (
        <div className="tw-p-8 tw-grid tw-grid-rows-auto tw-gap-8">
            <div className="tw-flex tw-flex-row tw-row-start-1">
                <div className="tw-basis-1/4">
                    <Form method="post">
                        <input
                            type="hidden"
                            name="action"
                            value="facebook"
                        />
                        <button className="tw-lp-button tw-bg-blue-500">Authorize Facebook Account</button>
                    </Form>
                </div>
                <div className="tw-basis-1/4">
                    <Form method="post">
                        <input
                            type="hidden"
                            name="action"
                            value="google"
                        />
                        <button className="tw-lp-button tw-bg-blue-700 disabled:opacity-25">Authorize Google Account</button>
                    </Form>
                </div>
            </div>
            <div className="tw-row-start-2 tw-bg-dark-bg-500 tw-p-8 tw-m-4">
                <SectionHeader label="Google Ads' Connectors" />
                <div className="tw-grid tw-grid-rows-auto tw-gap-2">
                    <div className="tw-flex tw-flex-col tw-w-auto tw-gap-y-4">
                        <div className="tw-flex tw-flex-row tw-flex-auto tw-gap-x-8 tw-items-center tw-justify-center">
                            <div className="tw-font-bold tw-font-sans">Connector Id</div>
                            <div className="tw-font-bold tw-font-sans">Account Id</div>
                            <div className="tw-font-bold tw-font-sans">Actions</div>
                        </div>
                        {loaderData.googleAdsConnectors.length > 0 ? (
                            <ItemBuilder
                                items={loaderData.googleAdsConnectors}
                                itemBuilder={(connector, connectorIndex) => (
                                    <Form
                                        method="post"
                                        className="tw-bg-dark-bg-500 tw-p-4 tw-flex tw-flex-row tw-gap-x-8 tw-flex-1 tw-items-center tw-justify-center"
                                    >
                                        <input
                                            type="hidden"
                                            name="action"
                                            value="deleteGoogleAds"
                                            className="tw-bg-dark-bg-500"
                                        />
                                        <input
                                            name="connectorId"
                                            value={connector.id}
                                            readOnly
                                            className="tw-bg-dark-bg-500"
                                        />
                                        <input
                                            name="loginCustomerId"
                                            value={connector.accountId}
                                            readOnly
                                            className="tw-bg-dark-bg-500"
                                        />
                                        <button className="tw-lp-button tw-bg-red-500 disabled:opacity-25">Delete Connector</button>
                                    </Form>
                                )}
                            />
                        ) : (
                            <></>
                        )}
                    </div>
                </div>
            </div>
            <div className="tw-row-start-3 tw-bg-dark-bg-500 tw-p-8 tw-m-4">
                <SectionHeader label="Facebook Ads' Connectors" />
                <div className="tw-grid tw-grid-rows-auto tw-gap-2">
                    <div className="tw-flex tw-flex-col tw-w-auto tw-gap-y-4">
                        <div className="tw-flex tw-flex-row tw-flex-auto tw-gap-x-8 tw-items-center tw-justify-center">
                            <div className="tw-font-bold tw-font-sans">Connector Id</div>
                            <div className="tw-font-bold tw-font-sans">Account Id</div>
                            <div className="tw-font-bold tw-font-sans">Actions</div>
                        </div>
                        {loaderData.facebookAdsConnectors.length > 0 ? (
                            <ItemBuilder
                                items={loaderData.facebookAdsConnectors}
                                itemBuilder={(connector, connectorIndex) => (
                                    <Form
                                        method="post"
                                        className="tw-bg-dark-bg-500 tw-p-4 tw-flex tw-flex-row tw-gap-x-8 tw-flex-1 tw-items-center tw-justify-center"
                                    >
                                        <input
                                            type="hidden"
                                            name="action"
                                            value="deleteGoogleAds"
                                            className="tw-bg-dark-bg-500 tw-w-auto"
                                        />
                                        <input
                                            name="connectorId"
                                            value={connector.id}
                                            readOnly
                                            className="tw-bg-dark-bg-500 tw-w-auto"
                                        />
                                        <input
                                            name="loginCustomerId"
                                            value={connector.accountId}
                                            readOnly
                                            className="tw-bg-dark-bg-500 tw-w-auto"
                                        />
                                        <button className="tw-lp-button tw-bg-red-500 disabled:opacity-25">Delete Connector</button>
                                    </Form>
                                )}
                            />
                        ) : (
                            <></>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
