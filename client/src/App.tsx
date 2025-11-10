import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EntriesProvider } from "./context/EntriesContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import Home from "@/pages/Home";
import Artists from "@/pages/Artists";
import Tags from "@/pages/Tags";
import Keywords from "@/pages/Keywords";
import Titles from "@/pages/Titles";
import TagPage from "@/pages/TagPage";
import ArtistPage from "@/pages/ArtistPage";
import KeywordPage from "@/pages/KeywordPage";
import CreateEntry from "@/pages/CreateEntry";
import SequenceGallery from "@/pages/SequenceGallery";
import StoryViewer from "@/pages/StoryViewer";
import ArtistRankings from "@/pages/ArtistRankings";
import ShareHandler from "@/pages/ShareHandler";
import InstallPWA from "@/pages/InstallPWA";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/artists" component={Artists} />
      <Route path="/artist/:artistName" component={ArtistPage} />
      <Route path="/tags" component={Tags} />
      <Route path="/tags/:tagName" component={TagPage} />
      <Route path="/keywords" component={Keywords} />
      <Route path="/titles" component={Titles} />
      <Route path="/keyword/:keyword" component={KeywordPage} />
      <Route path="/create" component={CreateEntry} />
      <Route path="/sequence/:id" component={SequenceGallery} />
      <Route path="/story/:id" component={StoryViewer} />
      <Route path="/artist-rankings" component={ArtistRankings} />
      <Route path="/share-handler" component={ShareHandler} />
      <Route path="/install-pwa" component={InstallPWA} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <EntriesProvider>
              <Toaster />
              <Router />
            </EntriesProvider>
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
