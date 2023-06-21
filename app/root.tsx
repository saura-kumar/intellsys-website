import type {LinksFunction, LoaderFunction, MetaFunction} from "@remix-run/node";
import {json} from "@remix-run/node";
import type {ShouldRevalidateFunction} from "@remix-run/react";
import {Links, LiveReload, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useTransition} from "@remix-run/react";
import {ToastContainer} from "react-toastify";
import reactToastifyStylesheet from "react-toastify/dist/ReactToastify.css";
import {getAccessibleCompanies, getNameAndPrivilegesForUser} from "~/backend/userDetails.server";
import {getAccessTokenFromCookies} from "~/backend/utilities/cookieSessionsHelper.server";
import {HeaderComponent} from "~/components/headerComponent";
import {LoaderComponent} from "~/components/loaderComponent";
import tailwindStylesheet from "~/tailwind.css";
import type {Company, User} from "~/utilities/typeDefinitions";

type LoaderData = {
    userDetails: User | null;
    accessibleCompanies: Array<Company> | null;
    currentCompany: Company | null;
};

export const loader: LoaderFunction = async ({request}) => {
    // TODO: Remove all this from here

    const accessToken = await getAccessTokenFromCookies(request);

    if (accessToken == null) {
        const loaderData: LoaderData = {
            userDetails: null,
            accessibleCompanies: null,
            currentCompany: null,
        };

        return json(loaderData);
    }

    const userDetails = await getNameAndPrivilegesForUser(accessToken.userId);
    const accessibleCompanies = await getAccessibleCompanies(userDetails);

    let currentCompany: Company | null = null;
    const currentUrl = request.url;
    const companyIdExtractorRegex = /https?:\/\/[^/]+($|\/$|\/([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})(\/.+)?)/;
    const matches = currentUrl.match(companyIdExtractorRegex);
    if (matches == null || matches.length != 4 || matches[2] == null) {
        currentCompany = null;
    } else {
        const currentCompanyId = matches[2];
        for (const company of accessibleCompanies) {
            if (company.id == currentCompanyId) {
                currentCompany = company;
                break;
            }
        }
    }

    const loaderData: LoaderData = {
        userDetails: userDetails,
        accessibleCompanies: accessibleCompanies,
        currentCompany: currentCompany,
    };

    return json(loaderData);
};

export const shouldRevalidate: ShouldRevalidateFunction = () => {
    return true;
};

export const meta: MetaFunction = () => ({
    charset: "utf-8",
    title: "Intellsys",
    viewport: "width=device-width,initial-scale=1",
});

export const links: LinksFunction = () => [
    {rel: "stylesheet", href: tailwindStylesheet},
    {rel: "stylesheet", href: reactToastifyStylesheet},
    {rel: "stylesheet", href: "https://fonts.googleapis.com/css?family=Poppins"},
];

export default function App() {
    const transition = useTransition();

    const {userDetails, accessibleCompanies, currentCompany} = useLoaderData();

    return (
        <html lang="en">
            <head>
                <Meta />
                <Links />
            </head>

            <body className="tw-bg-dark-bg-400 tw-text-base tw-text-fg">
                <div className="tw-grid tw-grid-rows-[auto_1fr] tw-min-h-screen">
                    {transition.state == "idle" ? null : <LoaderComponent />}
                    <HeaderComponent
                        userDetails={userDetails}
                        accessibleCompanies={accessibleCompanies}
                        currentCompany={currentCompany}
                        className="tw-row-start-1 tw-z-50"
                    />
                    <div className="tw-row-start-2">
                        <Outlet />
                    </div>
                </div>

                <ToastContainer
                    position="top-right"
                    autoClose={false}
                    theme="dark"
                />

                <ScrollRestoration />
                <Scripts />
                <LiveReload />
            </body>
        </html>
    );
}
