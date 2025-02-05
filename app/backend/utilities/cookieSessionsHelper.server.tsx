import jwt from "jsonwebtoken";
import {getCookieSession} from "~/backend/utilities/cookieSessions.server";
import {getNonEmptyStringFromUnknown, safeParse} from "~/global-common-typescript/utilities/typeValidationUtilities";
import type {User, Uuid} from "~/utilities/typeDefinitions";
import { getRequiredEnvironmentVariable } from "./utilities.server";
// import {getUserDetailsFromDatabase} from "~/backend/userDetails.server";

export type AccessToken = {
    userId: string;
    schemaVersion: string;
};

export async function getAccessTokenFromCookies(request: Request): Promise<null | AccessToken> {
    const session = await getCookieSession(request.headers.get("Cookie"));

    if (!session.has("accessToken")) {
        return null;
    }

    const accessToken = safeParse(getNonEmptyStringFromUnknown, session.get("accessToken"));
    if (accessToken == null) {
        return null;
    }

    return await decodeAccessToken(accessToken);
}

export async function getAccessTokenFromAuthorizationHeader(request: Request): Promise<null | AccessToken> {
    const authorizationHeader = safeParse(getNonEmptyStringFromUnknown, request.headers.get("Authorization"));
    if (authorizationHeader == null) {
        return null;
    }

    const authorizationHeaderPattern = "^Bearer (.+)$";
    const matches = authorizationHeader.match(authorizationHeaderPattern);
    if (matches == null) {
        return null;
    }

    const accessToken = matches[1];

    return await parseAccessTokenFromString(accessToken);
}

async function parseAccessTokenFromString(accessTokenEncoded: string): Promise<null | AccessToken> {
    // TODO: Ensure the accessToken is still valid, otherwise redirect user to a page to regenerate accessToken from refreshToken and so on
    return await decodeAccessToken(accessTokenEncoded);
}

async function decodeAccessToken(accessToken: string): Promise<null | AccessToken> {
    let accessTokenDecoded;

    try {
        accessTokenDecoded = jwt.verify(accessToken, getRequiredEnvironmentVariable("JWT_SECRET"));

        if (accessTokenDecoded.schemaVersion != process.env.COOKIE_SCHEMA_VERSION) {
            return null;
        }

        // TODO: Add additional checks for structure of token?
    } catch {
        accessTokenDecoded = null;
    }

    return accessTokenDecoded;
}

export async function getUserDetailsFromCookies(
    request: Request,
    requestedFields?: {
        // phoneNumber?: boolean;
        // name?: boolean;
    },
): Promise<User | null> {
    const accessToken = await getAccessTokenFromCookies(request);
    if (accessToken == null) {
        return null;
    }

    const userId = accessToken.userId;

    return getUserDetails(userId, requestedFields);
}

export async function getUserDetailsFromAuthenticationHeader(
    request: Request,
    requestedFields?: {
        // phoneNumber?: boolean;
        // name?: boolean;
    },
): Promise<User | null> {
    const accessToken = await getAccessTokenFromAuthorizationHeader(request);
    if (accessToken == null) {
        return null;
    }

    return getUserDetails(accessToken.userId, requestedFields);
}

export async function getUserDetails(
    userId: string,
    requestedFields?: {
        // phoneNumber?: boolean;
        // name?: boolean;
    },
): Promise<User | null> {
    // const userDetails: User = {
    //     id: userId,
    // };

    // if (
    //     requestedFields != null &&
    //     (requestedFields.phoneNumber ||
    //         requestedFields.name)
    // ) {
    //     const userDetailsFromDatabase = await getUserDetailsFromDatabase(userId);

    //     // TODO: Do this check outside the if?
    //     if (userDetailsFromDatabase == null) {
    //         return null;
    //     }

    //     if (requestedFields.phoneNumber) {
    //         // Handle undefined values, empty values
    //         userDetails.phoneNumber = userDetailsFromDatabase.phoneNumber;
    //     }

    //     if (requestedFields.name) {
    //         // Handle undefined values, empty values
    //         userDetails.name = userDetailsFromDatabase.name;
    //     }
    // }

    // return userDetails;

    return null;
}

export async function createAuthenticationToken(userId: Uuid) {
    return jwt.sign({userId: userId, schemaVersion: process.env.COOKIE_SCHEMA_VERSION}, process.env.JWT_SECRET);
}
