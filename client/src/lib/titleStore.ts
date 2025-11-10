import { apiRequest } from "./queryClient";

export async function getTitle(entryId: number): Promise<string | null> {
  try {
    const response = await apiRequest("GET", `/api/titles/${entryId}`);
    const data = await response.json();
    return data.title;
  } catch (error) {
    // Title not found is expected for entries without custom titles
    if (error instanceof Error && error.message.includes('404')) {
      return null;
    }
    throw error;
  }
}

export async function setTitle(entryId: number, title: string): Promise<void> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Title cannot be empty");
  }

  await apiRequest("POST", "/api/titles", {
    entryId,
    title: trimmedTitle,
  });
}
