
import liff from '@line/liff';

// You should ensure VITE_LIFF_ID is in your .env
// If not, we fall back to a hardcoded one or URL params
const LIFF_ID = import.meta.env.VITE_LIFF_ID || '';

export interface LiffUser {
    userId: string | null;
    displayName?: string;
    pictureUrl?: string;
    error?: string;
    isLoggingIn?: boolean; // [NEW] Flag to indicate if we are in the middle of a login redirect
}

let liffInitPromise: Promise<void> | null = null;

export const getLiffUser = async (options: { requireLogin?: boolean } = {}): Promise<LiffUser> => {
    console.log("Initializing LIFF with ID:", LIFF_ID);

    try {
        if (!LIFF_ID) {
            console.warn("VITE_LIFF_ID is missing from .env");
            // Fallback: Try to get from URL only
            const params = new URLSearchParams(window.location.search);
            const urlUserId = params.get('userId');
            return { userId: urlUserId, error: "Missing LIFF ID" };
        }

        // [MOD] Prevent concurrent liff.init() calls
        if (!liffInitPromise) {
            liffInitPromise = liff.init({ liffId: LIFF_ID });
        }
        await liffInitPromise;

        if (!liff.isLoggedIn()) {
            console.log("Not logged in.");

            // Check URL fallback first regardless of login requirement
            const params = new URLSearchParams(window.location.search);
            if (window.location.hash.includes('?')) {
                const hashQuery = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQuery);
                hashParams.forEach((val, key) => params.append(key, val));
            }
            const urlUserId = params.get('userId');

            // Only use urlUserId if we are not explicitly trying to login securely
            if (urlUserId && !options.requireLogin) {
                console.log("Found userId in URL, bypassing login for testing.");
                return { userId: urlUserId };
            }

            // Only force login if explicitly requested
            if (options.requireLogin) {
                console.log("Login required. Calling login()...");
                liff.login();
                return { userId: null, isLoggingIn: true }; // [MOD] indicate redirecting
            } else {
                console.log("Login not required. Returning null user.");
                return { userId: null };
            }
        }

        const profile = await liff.getProfile();
        console.log("LIFF Profile retrieved:", profile);
        return {
            userId: profile.userId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
        };

    } catch (e: any) {
        console.error("LIFF Init Failed:", e);

        // Final Fallback to URL if we didn't require strict secure login
        if (!options.requireLogin) {
            const params = new URLSearchParams(window.location.search);
            const urlUserId = params.get('userId');
            if (urlUserId) {
                return {
                    userId: urlUserId,
                    error: e.message || "LIFF Init Failed but found URL userId"
                };
            }
        }

        return {
            userId: null,
            error: e.message || "LIFF Init Failed"
        };
    }
};

export const getLiffId = () => LIFF_ID;
