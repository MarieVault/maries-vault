# Marie's Vault

A personal digital art collection and media management app. Organise, tag, and browse your image and video collection — with direct import from Twitter/X via link.

## Features

- 📥 **Twitter/X import** — paste a tweet URL and automatically import the images or videos
- 🏷️ **Tagging & search** — tag your collection and find anything instantly
- 🖼️ **Image & video support** — handles JPG, PNG, GIF, MP4 and more
- 📚 **Comics & sequences** — group related images into ordered sequences
- 📖 **Stories** — attach narrative context to your collections
- 🌙 **Dark UI** — clean, mobile-friendly interface

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL via Drizzle ORM
- **File handling:** Local storage with configurable upload paths

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

```bash
git clone https://github.com/MarieVault/maries-vault.git
cd maries-vault
npm install
```

### Configuration

Create a `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/maries_vault
SESSION_SECRET=your-secret-here
```

### Database setup

```bash
npm run db:push
```

### Run

```bash
npm run dev      # development
npm run build    # production build
npm start        # production server
```

## Project Structure

```
client/          # React frontend
server/          # Express backend
shared/          # Shared types and schemas
migrations/      # Database migrations
```

## License

MIT
