import { useAuthStore } from "@/stores/authStore";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadSession } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    loadSession();
  }, []);

  // Cached data belongs to whoever was signed in — never show it to the
  // next account on this phone.
  useEffect(() => {
    if (!isAuthenticated) queryClient.clear();
  }, [isAuthenticated]);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
    SplashScreen.hideAsync();
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="round/[id]"
              options={{ presentation: "card" }}
            />
            <Stack.Screen
              name="round/[id]/summary"
              options={{ presentation: "card" }}
            />
            <Stack.Screen
              name="round/new"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="session/[code]"
              options={{ presentation: "card" }}
            />
            <Stack.Screen
              name="session/new"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="session/join"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="notifications" options={{ presentation: "card" }} />
            <Stack.Screen name="settings" options={{ presentation: "card" }} />
            <Stack.Screen name="friends/[id]" options={{ presentation: "card" }} />
            <Stack.Screen
              name="courses/index"
              options={{ presentation: "modal" }}
            />
          </Stack>
        </AuthGuard>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
