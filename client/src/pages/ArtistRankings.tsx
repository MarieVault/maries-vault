import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Palette, Star, TrendingUp, BarChart3, Award } from "lucide-react";

interface ArtistRankingData {
  rank: number;
  name: string;
  totalEntries: number;
  ratedEntries: number;
  averageRating: number;
  weightedRating: number;
  tags: string[];
}

interface RankingsResponse {
  rankings: ArtistRankingData[];
  metadata: {
    minRatedEntries: number;
    totalRankedArtists: number;
  };
}

function ArtistRankingCard({ artist }: { artist: ArtistRankingData }) {
  const { rank } = artist;

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <TrendingUp className="text-yellow-500" size={20} />;
    if (rank === 2) return <Award className="text-gray-400" size={20} />;
    if (rank === 3) return <Award className="text-amber-600" size={20} />;
    return <Palette className="text-indigo-600" size={16} />;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900";
    if (rank === 2) return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900";
    if (rank === 3) return "bg-gradient-to-r from-amber-400 to-amber-500 text-amber-900";
    return "bg-gray-100 text-gray-700";
  };

  return (
    <Link href={`/artists/${encodeURIComponent(artist.name)}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${getRankBadge(rank)}`}>
              {rank}
            </div>
            {getRankIcon(rank)}
            <div>
              <h3 className="font-semibold text-gray-900">{artist.name}</h3>
              <p className="text-xs text-gray-500">
                {artist.totalEntries} {artist.totalEntries === 1 ? 'entry' : 'entries'}
                {' '}({artist.ratedEntries} rated)
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center space-x-1">
              <Star className="text-yellow-500 fill-current" size={16} />
              <span className="font-bold text-lg text-gray-900">
                {artist.averageRating.toFixed(1)}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              weighted: {artist.weightedRating.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {artist.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs px-2 py-0">
              {tag}
            </Badge>
          ))}
          {artist.tags.length > 3 && (
            <Badge variant="outline" className="text-xs px-2 py-0">
              +{artist.tags.length - 3} more
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}


export default function ArtistRankings() {
  const { data, isLoading } = useQuery<RankingsResponse>({
    queryKey: ["/api/artists/rankings"],
  });

  const rankedArtists = data?.rankings || [];
  const minRatedEntries = data?.metadata?.minRatedEntries || 3;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center justify-between h-12 px-4 max-w-4xl mx-auto">
            <Link href="/">
              <Button variant="ghost" size="sm" className="p-0">
                <ArrowLeft size={16} className="mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">Artist Rankings</h1>
            <div className="w-16"></div>
          </div>
        </header>
        <main className="p-4 max-w-4xl mx-auto">
          <div className="mt-6 space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
                <div className="h-20 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between h-12 px-4 max-w-4xl mx-auto">
          <Link href="/">
            <Button variant="ghost" size="sm" className="p-0">
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">Artist Rankings</h1>
          <div className="w-16"></div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="text-indigo-600" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Artists by Weighted Rating</h2>
          </div>
          <p className="text-gray-600 text-sm">
            Artists ranked using Bayesian average to balance rating quality with sample size.
            Minimum {minRatedEntries} rated entries required.
          </p>
        </div>

        {rankedArtists.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Star className="mx-auto mb-4 text-gray-300" size={48} />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Ranked Artists Yet</h3>
            <p className="text-sm">Artists need at least {minRatedEntries} rated entries to appear in rankings.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rankedArtists.map((artist) => (
              <ArtistRankingCard
                key={artist.name}
                artist={artist}
              />
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Star className="text-blue-600" size={16} />
            <h3 className="font-semibold text-blue-900">How Rankings Work</h3>
          </div>
          <p className="text-sm text-blue-800 mb-2">
            Rankings use a <strong>Bayesian average</strong> that balances an artist's rating with
            the number of rated entries. This prevents artists with few highly-rated entries from
            unfairly outranking artists with many consistently good entries.
          </p>
          <p className="text-sm text-blue-800">
            Artists must have at least <strong>{minRatedEntries} rated entries</strong> to appear in rankings.
            Tap any artist card to view their full gallery.
          </p>
        </div>
      </main>
    </div>
  );
}
