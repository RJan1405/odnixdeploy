import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { MainLayout } from "./components/MainLayout";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import { CallNotificationHandler } from "./components/CallNotificationHandler";

// Lazy load pages for better performance
const HomePage = lazy(() => import("./pages/HomePage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const OmzoPage = lazy(() => import("./pages/OmzoPage"));
const ExplorePage = lazy(() => import("./pages/ExplorePage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CallPage = lazy(() => import("./pages/CallPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const OmzoDetailPage = lazy(() => import("./pages/OmzoDetailPage"));
const ScribePage = lazy(() => import("./pages/ScribePage"));


const queryClient = new QueryClient();

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CallNotificationHandler />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
              </Route>
              <Route
                path="/chat/:chatId"
                element={
                  <ProtectedRoute>
                    <ChatPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/omzo"
                element={
                  <ProtectedRoute>
                    <OmzoPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/omzo/:omzoId"
                element={
                  <ProtectedRoute>
                    <OmzoDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/scribe/:scribeId"
                element={
                  <ProtectedRoute>
                    <ScribePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/call/:chatId"
                element={
                  <ProtectedRoute>
                    <CallPage />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
