import type {ActionFunction, LinksFunction, LoaderFunction} from "@remix-run/node";
import {json, redirect} from "@remix-run/node";
import {Form, Link, useLoaderData, useMatches} from "@remix-run/react";
import {Facebook} from "react-bootstrap-icons";
import type {ConnectorConfig} from "~/backend/utilities/connectors/common.server";
import {deleteConnector, getConnectorsAssociatedWithCompanyId, getRedirectUri} from "~/backend/utilities/connectors/common.server";
import {getFacebookAuthorizationCodeUrl} from "~/backend/utilities/connectors/facebookOAuth.server";
import {getGoogleAuthorizationCodeUrl, googleAdsScope, googleAnalyticsScope} from "~/backend/utilities/connectors/googleOAuth.server";
import {PageScaffold} from "~/components/pageScaffold";
import {ItemBuilder} from "~/components/reusableComponents/itemBuilder";
import {SectionHeader} from "~/components/scratchpad";
import {HiddenFormField} from "~/global-common-typescript/components/hiddenFormField";
import {HorizontalSpacer} from "~/global-common-typescript/components/horizontalSpacer";
import {VerticalSpacer} from "~/global-common-typescript/components/verticalSpacer";
import {getErrorFromUnknown, getUuidFromUnknown, safeParse} from "~/global-common-typescript/utilities/typeValidationUtilities";
import {getSingletonValue} from "~/global-common-typescript/utilities/utilities";
import type {Uuid} from "~/utilities/typeDefinitions";
import {ConnectorType, dataSourcesAbbreviations} from "~/utilities/typeDefinitions";
import type {CompanyLoaderData} from "../$companyId";
import {logBackendError} from "~/global-common-typescript/server/logging.server";

export const action: ActionFunction = async ({request, params}) => {
    try {
        const body = await request.formData();
        const companyId = params.companyId;
        if (companyId == null) {
            throw new Response(null, {status: 404});
        }

        const companyIdUuid = getUuidFromUnknown(companyId);

        if (body.get("action") == "facebook") {
            const redirectUri = getRedirectUri(companyIdUuid, getUuidFromUnknown(ConnectorType.FacebookAds));
            if (redirectUri instanceof Error) {
                return "Facebook Ads redirect uri not defined!";
            }

            const authUrl = getFacebookAuthorizationCodeUrl(redirectUri, companyIdUuid);

            return redirect(authUrl);
        } else if (body.get("action") == "googleAds") {
            const redirectUri = getRedirectUri(companyIdUuid, getUuidFromUnknown(ConnectorType.GoogleAds));
            if (redirectUri instanceof Error) {
                return "Google Ads redirect uri not defined!";
            }

            const authUrl = getGoogleAuthorizationCodeUrl(redirectUri, companyIdUuid, googleAdsScope);

            return redirect(authUrl);
        } else if (body.get("action") == "googleAnalytics") {
            const redirectUri = getRedirectUri(companyIdUuid, getUuidFromUnknown(ConnectorType.GoogleAnalytics));
            if (redirectUri instanceof Error) {
                return "Google Analytics redirect uri not defined!";
            }

            const authUrl = getGoogleAuthorizationCodeUrl(redirectUri, companyIdUuid, googleAnalyticsScope);

            return redirect(authUrl);
        } else if (body.get("action") == "deleteGoogleAds") {
            const connectorId = safeParse(getUuidFromUnknown, body.get("connectorId"));
            const accountId = safeParse(getUuidFromUnknown, body.get("accountId"));

            if (connectorId == null || accountId == null) {
                return new Response("ConnectorConfig or Account not found for Google Ads!", {status: 400});
            }

            await deleteConnector(connectorId, accountId, dataSourcesAbbreviations.googleAds);
        } else if (body.get("action") == "deleteFacebookAds") {
            const connectorId = safeParse(getUuidFromUnknown, body.get("connectorId"));
            const adAccountId = safeParse(getUuidFromUnknown, body.get("adAccountId"));

            if (connectorId == null || adAccountId == null) {
                return new Response("ConnectorConfig or Account not found for Facebook Ads!", {status: 400});
            }

            await deleteConnector(connectorId, adAccountId, dataSourcesAbbreviations.facebookAds);
        } else if (body.get("action") == "deleteGoogleAnalytics") {
            const connectorId = safeParse(getUuidFromUnknown, body.get("connectorId"));
            const propertyId = safeParse(getUuidFromUnknown, body.get("propertyId"));

            if (connectorId == null || propertyId == null) {
                return new Response("ConnectorConfig or Account not found for Google Analytics!", {status: 400});
            }

            await deleteConnector(connectorId, propertyId, dataSourcesAbbreviations.googleAnalytics);
        }

        return null;
    } catch (error_) {
        const error = getErrorFromUnknown(error_);
        logBackendError(error);
    }
};

type LoaderData = {
    googleAdsConnectors: Array<ConnectorConfig>;
    facebookAdsConnectors: Array<ConnectorConfig>;
    googleAnalyticsConnectors: Array<ConnectorConfig>;
};

export const loader: LoaderFunction = async ({request, params}) => {
    try {
        // TODO: Ensure companyId is valid
        const companyId = params.companyId;
        if (companyId == null) {
            throw new Response(null, {status: 404});
        }

        const googleAdsConnectorDetails = await getConnectorsAssociatedWithCompanyId(getUuidFromUnknown(companyId), getUuidFromUnknown(ConnectorType.GoogleAds));
        if (googleAdsConnectorDetails instanceof Error) {
            return googleAdsConnectorDetails;
        }

        const facebookConnectorDetails = await getConnectorsAssociatedWithCompanyId(getUuidFromUnknown(companyId), getUuidFromUnknown(ConnectorType.FacebookAds));
        if (facebookConnectorDetails instanceof Error) {
            return facebookConnectorDetails;
        }

        const googleAnalyticsDetails = await getConnectorsAssociatedWithCompanyId(getUuidFromUnknown(companyId), getUuidFromUnknown(ConnectorType.GoogleAnalytics));
        if (googleAnalyticsDetails instanceof Error) {
            return googleAnalyticsDetails;
        }

        const loaderData: LoaderData = {
            googleAdsConnectors: googleAdsConnectorDetails,
            facebookAdsConnectors: facebookConnectorDetails,
            googleAnalyticsConnectors: googleAnalyticsDetails,
        };

        return json(loaderData);
    } catch (error_) {
        const error = getErrorFromUnknown(error_);
        logBackendError(error);
        return error;
    }
};

export const links: LinksFunction = () => [{rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Roboto&display=swap"}];

export default function () {
    const {googleAdsConnectors, facebookAdsConnectors, googleAnalyticsConnectors} = useLoaderData() as LoaderData;

    const routeMatches = useMatches();
    const {user, accessibleCompanies, currentCompany} = getSingletonValue(routeMatches.filter((routeMatch) => routeMatch.id == "routes/$companyId")).data as CompanyLoaderData;

    return (
        <PageScaffold
            user={user}
            accessibleCompanies={accessibleCompanies}
            currentCompany={currentCompany}
        >
            <DataSources
                googleAdsConnectors={googleAdsConnectors}
                facebookAdsConnectors={facebookAdsConnectors}
                googleAnalyticsConnectors={googleAnalyticsConnectors}
                companyId={currentCompany.id}
            />
        </PageScaffold>
    );
}

function DataSources({
    googleAdsConnectors,
    facebookAdsConnectors,
    googleAnalyticsConnectors,
    companyId,
}: {
    googleAdsConnectors: Array<ConnectorConfig>;
    facebookAdsConnectors: Array<ConnectorConfig>;
    googleAnalyticsConnectors: Array<ConnectorConfig>;
    companyId: Uuid;
}) {
    return (
        <div className="tw-p-8 tw-grid tw-grid-rows-auto tw-gap-8">
            <div className="tw-row-start-2 tw-bg-dark-bg-500 tw-p-8 tw-m-4">
                <SectionHeader label="Google Ads Sources" />

                <VerticalSpacer className="tw-h-4" />

                <div className="tw-grid tw-grid-rows-auto tw-gap-2">
                    {googleAdsConnectors.length == 0 ? (
                        <div className="tw-w-full tw-text-center">No connected account!</div>
                    ) : (
                        <table className="tw-w-full tw-border tw-border-solid tw-border-white">
                            <thead>
                                <tr className="tw-w-full tw-border tw-border-solid tw-border-white">
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Account</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Source Id</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <ItemBuilder
                                    items={googleAdsConnectors}
                                    itemBuilder={(connector, connectorIndex) => (
                                        <tr key={connectorIndex}>
                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Link
                                                    to={`/${companyId}/0be2e81c-f5a7-41c6-bc34-6668088f7c4e/${connector.id}`}
                                                    className="tw-text-blue-500"
                                                >
                                                    {connector.extraInformation.accountName} ({connector.accountId})
                                                </Link>
                                            </td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">{connector.id}</td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Form method="POST">
                                                    <HiddenFormField
                                                        name="action"
                                                        value="deleteGoogleAds"
                                                    />

                                                    <HiddenFormField
                                                        name="connectorId"
                                                        value={connector.id}
                                                    />

                                                    <HiddenFormField
                                                        name="accountId"
                                                        value={connector.accountId}
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="tw-text-red-500 disabled:tw-text-gray-600"
                                                    >
                                                        Delete
                                                    </button>
                                                </Form>
                                            </td>
                                        </tr>
                                    )}
                                />
                            </tbody>
                        </table>
                    )}
                </div>

                <VerticalSpacer className="tw-h-4" />

                <Form
                    method="POST"
                    className="tw-w-full tw-grid tw-grid-cols-[auto_auto] tw-justify-center tw-place-items-center tw-gap-x-4"
                >
                    <HiddenFormField
                        name="action"
                        value="googleAds"
                    />

                    <div>Add New Source:</div>

                    <button
                        type="submit"
                        className="tw-bg-[#4285f4] tw-text-white tw-flex tw-flex-row tw-rounded-[2px] tw-items-center tw-overflow-hidden"
                        style={{
                            fontFamily: "'Roboto', sans-serif",
                            fontSize: "14px",
                            border: "1px solid #4285f4",
                        }}
                    >
                        <div className="tw-h-[40px] tw-pt-[11px] tw-pl-2 tw-bg-white tw-flex-none">
                            <img
                                src="https://images.growthjockey.com/intellsys/common/google-logo.png"
                                alt="Google logo"
                                className="tw-w-[18px] tw-h-[18px]"
                            />
                        </div>
                        <HorizontalSpacer className="tw-w-3 tw-bg-white" />
                        <HorizontalSpacer className="tw-w-3" />
                        <div className=" tw-whitespace-nowrap tw-flex-none tw-pr-2">Sign in with Google</div>
                    </button>
                </Form>
            </div>

            <div className="tw-row-start-3 tw-bg-dark-bg-500 tw-p-8 tw-m-4">
                <SectionHeader label="Facebook Ads Sources" />

                <VerticalSpacer className="tw-h-4" />

                <div className="tw-grid tw-grid-rows-auto tw-gap-2">
                    {facebookAdsConnectors.length == 0 ? (
                        <div className="tw-w-full tw-text-center">No connected account!</div>
                    ) : (
                        <table className="tw-w-full tw-border tw-border-solid tw-border-white">
                            <thead>
                                <tr className="tw-w-full tw-border tw-border-solid tw-border-white">
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Account</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Source Id</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <ItemBuilder
                                    items={facebookAdsConnectors}
                                    itemBuilder={(connector, connectorIndex) => (
                                        <tr key={connectorIndex}>
                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Link
                                                    to={`/${companyId}/3350d73d-64c1-4c88-92b4-0d791d954ae9/${connector.id}`}
                                                    className="tw-text-blue-500"
                                                >
                                                    {connector.extraInformation.accountName} ({connector.accountId})
                                                </Link>
                                            </td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">{connector.id}</td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Form method="POST">
                                                    <HiddenFormField
                                                        name="action"
                                                        value="deleteFacebookAds"
                                                    />

                                                    <HiddenFormField
                                                        name="connectorId"
                                                        value={connector.id}
                                                    />

                                                    <HiddenFormField
                                                        name="adAccountId"
                                                        value={connector.accountId}
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="tw-text-red-500 disabled:tw-text-gray-600"
                                                    >
                                                        Delete
                                                    </button>
                                                </Form>
                                            </td>
                                        </tr>
                                    )}
                                />
                            </tbody>
                        </table>
                    )}
                </div>

                <VerticalSpacer className="tw-h-4" />

                <Form
                    method="POST"
                    className="tw-w-full tw-grid tw-grid-cols-[auto_auto] tw-justify-center tw-place-items-center tw-gap-x-4"
                >
                    <input
                        type="hidden"
                        name="action"
                        value="facebook"
                    />

                    <div>Add New Source:</div>

                    <button
                        type="submit"
                        className="tw-bg-[#1877F2] tw-text-white tw-flex tw-flex-row tw-gap-x-2 tw-rounded-[6px] tw-p-2"
                        style={{
                            fontFamily: "Arial",
                            letterSpacing: "0.04rem",
                        }}
                    >
                        <Facebook className="tw-w-6 tw-h-6 tw-flex-none" />
                        <div className="tw-whitespace-nowrap tw-flex-none tw-font-bold">Login with Facebook</div>
                    </button>
                </Form>
            </div>

            <div className="tw-row-start-4 tw-bg-dark-bg-500 tw-p-8 tw-m-4">
                <SectionHeader label="Google Analytics Sources" />

                <VerticalSpacer className="tw-h-4" />

                <div className="tw-grid tw-grid-rows-auto tw-gap-2">
                    {googleAnalyticsConnectors.length == 0 ? (
                        <div className="tw-w-full tw-text-center">No connected account!</div>
                    ) : (
                        <table className="tw-w-full tw-border tw-border-solid tw-border-white">
                            <thead>
                                <tr className="tw-w-full tw-border tw-border-solid tw-border-white">
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Account</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Source Id</th>
                                    <th className="tw-w-full tw-border tw-border-solid tw-border-white tw-text-left tw-p-2 tw-whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                <ItemBuilder
                                    items={googleAnalyticsConnectors}
                                    itemBuilder={(connector, connectorIndex) => (
                                        <tr key={connectorIndex}>
                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Link
                                                    to={`/${companyId}/6cd015ff-ec2e-412a-a777-f983fbdcb63e/${connector.id}`}
                                                    className="tw-text-blue-500"
                                                >
                                                    {connector.extraInformation.accountName} ({connector.accountId})
                                                </Link>
                                            </td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">{connector.id}</td>

                                            <td className="tw-w-full tw-border tw-border-solid tw-border-white tw-p-2 tw-whitespace-nowrap">
                                                <Form method="POST">
                                                    <HiddenFormField
                                                        name="action"
                                                        value="deleteGoogleAnalytics"
                                                    />

                                                    <HiddenFormField
                                                        name="connectorId"
                                                        value={connector.id}
                                                    />

                                                    <HiddenFormField
                                                        name="propertyId"
                                                        value={connector.accountId}
                                                    />

                                                    <button
                                                        type="submit"
                                                        className="tw-text-red-500 disabled:tw-text-gray-600"
                                                    >
                                                        Delete
                                                    </button>
                                                </Form>
                                            </td>
                                        </tr>
                                    )}
                                />
                            </tbody>
                        </table>
                    )}
                </div>

                <VerticalSpacer className="tw-h-4" />

                <Form
                    method="POST"
                    className="tw-w-full tw-grid tw-grid-cols-[auto_auto] tw-justify-center tw-place-items-center tw-gap-x-4"
                >
                    <input
                        type="hidden"
                        name="action"
                        value="googleAnalytics"
                    />

                    <div>Add New Source:</div>

                    <button
                        type="submit"
                        className="tw-bg-[#4285f4] tw-text-white tw-flex tw-flex-row tw-rounded-[2px] tw-items-center tw-overflow-hidden"
                        style={{
                            fontFamily: "'Roboto', sans-serif",
                            fontSize: "14px",
                            border: "1px solid #4285f4",
                        }}
                    >
                        <div className="tw-h-[40px] tw-pt-[11px] tw-pl-2 tw-bg-white tw-flex-none">
                            <img
                                src="https://images.growthjockey.com/intellsys/common/google-logo.png"
                                alt="Google logo"
                                className="tw-w-[18px] tw-h-[18px]"
                            />
                        </div>
                        <HorizontalSpacer className="tw-w-3 tw-bg-white" />
                        <HorizontalSpacer className="tw-w-3" />
                        <div className=" tw-whitespace-nowrap tw-flex-none tw-pr-2">Sign in with Google</div>
                    </button>
                </Form>
            </div>
        </div>
    );
}
