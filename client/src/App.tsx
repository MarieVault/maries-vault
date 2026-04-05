import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EntriesProvider } from "./context/EntriesContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { BlurProvider } from "./context/BlurContext";
import Home from "@/pages/Home";
import Artists from "@/pages/Artists";
import Tags from "@/pages/Tags";
import TagPage from "@/pages/TagPage";
import ArtistPage from "@/pages/ArtistPage";
import CreateEntry from "@/pages/CreateEntry";
import SequenceGallery from "@/pages/SequenceGallery";
import StoryViewer from "@/pages/StoryViewer";
import ArtistRankings from "@/pages/ArtistRankings";
import ShareHandler from "@/pages/ShareHandler";
import InstallPWA from "@/pages/InstallPWA";
import TwitterImport from "@/pages/TwitterImport";
import ImageViewer from "@/pages/ImageViewer";
import Gallery from "@/pages/Gallery";
import Login from "@/pages/Login";
import MyCollection from "@/pages/MyCollection";
import AdminDashboard from "@/pages/AdminDashboard";
import DMCAPage from "@/pages/DMCA";
import TermsPage from "@/pages/Terms";
import MangaList from "@/pages/MangaList";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/artists" component={Artists} />
      <Route path="/artist/:artistName" component={ArtistPage} />
      <Route path="/tags" component={Tags} />
      <Route path="/tags/:tagName" component={TagPage} />
      <Route path="/twitter" component={TwitterImport} />
      <Route path="/create" component={CreateEntry} />
      <Route path="/sequence/:id" component={SequenceGallery} />
      <Route path="/image/:id" component={ImageViewer} />
      <Route path="/story/:id" component={StoryViewer} />
      <Route path="/artist-rankings" component={ArtistRankings} />
      <Route path="/share-handler" component={ShareHandler} />
      <Route path="/install-pwa" component={InstallPWA} />
      <Route path="/gallery" component={Gallery} />
      <Route path="/login" component={Login} />
      <Route path="/collection" component={MyCollection} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/dmca" component={DMCAPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/mangalist" component={MangaList} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BlurProvider>
        <ThemeProvider>
          <TooltipProvider>
            <EntriesProvider>
              <Toaster />
              <Router />
            </EntriesProvider>
          </TooltipProvider>
        </ThemeProvider>
        </BlurProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
