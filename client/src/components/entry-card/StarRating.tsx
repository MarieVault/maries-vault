import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number | null;
  onRate: (star: number) => void;
}

// Renders the 5-star personal rating row. Owns its own hover state.
export default function StarRating({ rating, onRate }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  return (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRate(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
                  title={star === rating ? "Click to clear rating" : `Rate ${star} star${star !== 1 ? 's' : ''}`}
                >
                  <Star
                    size={16}
                    className={`transition-colors duration-200 ${
                      star <= (hoverRating || rating || 0)
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300 hover:text-yellow-300'
                    }`}
                  />
                </button>
              ))}
              {rating && (
                <span className="text-xs text-gray-500 ml-2">{rating}/5</span>
              )}
            </div>
          </div>
  );
}
