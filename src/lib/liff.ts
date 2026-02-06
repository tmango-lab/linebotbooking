
import liff from '@line/liff';

// You should ensure VITE_LIFF_ID is in your .env
// If not, we fall back to a hardcoded one or URL params
const LIFF_ID = import.meta.env.VITE_LIFF_ID || '';

export interface LiffUser {
    userId: string | null;
    displayName?: string;
    pictureUrl?: string;
    error?: string;
}

export const getLiffUser = async (): Promise<LiffUser> => {
    console.log("Initializing LIFF with ID:", LIFF_ID);

    try {
        if (!LIFF_ID) {
            console.warn("VITE_LIFF_ID is missing from .env");
            // Fallback: Try to get from URL only
            const params = new URLSearchParams(window.location.search);
            const urlUserId = params.get('userId');
            return { userId: urlUserId, error: "Missing LIFF ID" };
        }

        await liff.init({ liffId: LIFF_ID });

        if (!liff.isLoggedIn()) {
            console.log("Not logged in, checking URL for fallback userId...");
            const params = new URLSearchParams(window.location.search);
            // Check hash params too
            if (window.location.hash.includes('?')) {
                const hashQuery = window.location.hash.split('?')[1];
                const hashParams = new URLSearchParams(hashQuery);
                hashParams.forEach((val, key) => params.append(key, val));
            }
            const urlUserId = params.get('userId');

            if (urlUserId) {
                console.log("Found userId in URL, bypassing login for testing.");
                return { userId: urlUserId };
            }

            console.log("No userId in URL, calling login()...");
            liff.login();
            return { userId: null }; // Redirecting...
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
        // Fallback to URL
        const params = new URLSearchParams(window.location.search);
        const urlUserId = params.get('userId');
        return {
            userId: urlUserId,
            error: e.message || "LIFF Init Failed"
        };
    }
};

export const getLiffId = () => LIFF_ID;
