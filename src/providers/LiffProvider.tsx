
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getLiffUser, type LiffUser } from '../lib/liff';

interface LiffContextType {
    liffUser: LiffUser | null;
    isReady: boolean;
    error: string | null;
}

const LiffContext = createContext<LiffContextType>({
    liffUser: null,
    isReady: false,
    error: null,
});

export const useLiff = () => useContext(LiffContext);

export const LiffProvider = ({ children }: { children: ReactNode }) => {
    const [liffUser, setLiffUser] = useState<LiffUser | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const init = async () => {
            try {
                // Check if we are already redirected from login (e.g. hash params exist)
                // This 'getLiffUser' function in lib/liff.ts already handles init() and login()
                // We just need to call it once here.
                const user = await getLiffUser();

                if (user.error && user.error !== 'Missing LIFF ID') {
                    // If error is "Missing LIFF ID", it might just be a dev env/web without param
                    // But if it's a real error, set it.
                    console.error("LIFF Provider Init Error:", user.error);
                    setError(user.error);
                }

                if (user.userId) {
                    setLiffUser(user);
                }
            } catch (err: any) {
                console.error("LIFF Provider Exception:", err);
                setError(err.message);
            } finally {
                setIsReady(true);
            }
        };

        init();
    }, []);

    return (
        <LiffContext.Provider value={{ liffUser, isReady, error }}>
            {children}
        </LiffContext.Provider>
    );
};
