import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Global QueryClient with sensible defaults
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Retry once on failure (network hiccups)
            retry: 1,
            // Don't refetch when window regains focus (acceptable for this use case)
            refetchOnWindowFocus: false,
            // Default staleTime: 1 minute (can be overridden per-query)
            staleTime: 60 * 1000,
        },
    },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

// Export queryClient so hooks can call invalidateQueries after mutations
export { queryClient };
