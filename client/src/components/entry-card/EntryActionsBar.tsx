import { Button } from "@/components/ui/button";
import { Archive, ArchiveRestore, Lock, Globe, Trash2 } from "lucide-react";
import type { Entry } from "@shared/schema";

interface EntryActionsBarProps {
  entry: Entry;
  isOwner: boolean;
  isAdmin: boolean;
  isArchiving: boolean;
  isTogglingVisibility: boolean;
  isDeleting: boolean;
  visibility: 'public' | 'private';
  onArchive: (archive: boolean) => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}

// Archive (any logged-in user) + Visibility (owner) + Delete (admin only).
export default function EntryActionsBar({
  entry, isOwner, isAdmin, isArchiving, isTogglingVisibility, isDeleting,
  visibility, onArchive, onToggleVisibility, onDelete,
}: EntryActionsBarProps) {
  return (
          <div className="pt-2 border-t border-gray-200 flex gap-2 flex-wrap">
            <Button
              onClick={() => onArchive(!entry.archived)}
              variant="outline"
              size="sm"
              disabled={isArchiving}
              className={entry.archived
                ? "text-green-600 border-green-300 hover:bg-green-50"
                : "text-amber-600 border-amber-300 hover:bg-amber-50"}
            >
              {entry.archived
                ? <><ArchiveRestore size={14} className="mr-1" />{isArchiving ? "Restoring..." : "Unarchive"}</>
                : <><Archive size={14} className="mr-1" />{isArchiving ? "Archiving..." : "Archive"}</>
              }
            </Button>
            {isOwner && (
              <Button
                onClick={onToggleVisibility}
                variant="outline"
                size="sm"
                disabled={isTogglingVisibility}
                className={visibility === 'private'
                  ? "text-slate-700 border-slate-300 hover:bg-slate-50"
                  : "text-sky-600 border-sky-300 hover:bg-sky-50"}
                title={visibility === 'private' ? "Make this entry public" : "Make this entry private"}
              >
                {visibility === 'private'
                  ? <><Globe size={14} className="mr-1" />{isTogglingVisibility ? "Updating..." : "Make public"}</>
                  : <><Lock size={14} className="mr-1" />{isTogglingVisibility ? "Updating..." : "Make private"}</>
                }
              </Button>
            )}
            {isAdmin && (
              <Button
                onClick={onDelete}
                variant="outline"
                size="sm"
                disabled={isDeleting}
                className="text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400 transition-colors duration-200"
              >
                <Trash2 size={14} className="mr-1" />
                {isDeleting ? "Deleting..." : "Delete Entry"}
              </Button>
            )}
          </div>
  );
}
