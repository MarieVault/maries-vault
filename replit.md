# Marie's Vault - Digital Art Collection Platform

## Overview

Marie's Vault is a full-stack web application for managing and organizing digital art collections. The platform allows users to store, tag, categorize, and view various types of digital content including images, comics, sequences, and stories. Built with a modern tech stack, it features a React frontend with TypeScript, Express.js backend, and PostgreSQL database with Drizzle ORM.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS with custom theming support
- **State Management**: TanStack Query for server state, React Context for local state
- **Routing**: Wouter for client-side routing
- **Bundler**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ES modules)
- **Framework**: Express.js with middleware for logging, error handling, and file uploads
- **Database ORM**: Drizzle ORM with PostgreSQL
- **File Storage**: Local file system with multer for uploads
- **API Integration**: OpenAI API for AI content generation, Replicate for image processing

### Authentication & Sessions
- Simple passcode-based authentication for demo purposes
- Session management using localStorage for client-side state persistence

## Key Components

### Database Schema
The application uses a PostgreSQL database with the following main tables:
- **users**: User account information
- **entries**: Main content entries (images, comics, sequences, stories)
- **titles**: Custom titles for entries
- **customEntries**: User customizations (custom images, artists, tags, keywords, ratings)
- **artistLinks**: Social media/platform links for artists

### Content Types
The platform supports four main content types:
- **Image**: Single image entries
- **Comic**: Comic-style content
- **Sequence**: Multiple images displayed as galleries
- **Story**: Text-based content generated via AI

### API Endpoints
- Entry management (CRUD operations)
- Custom data management (titles, tags, keywords)
- File upload and image processing
- AI story generation
- Artist link management

### Frontend Features
- Responsive design with mobile support
- Theme switching (neutral, babydoll, girly, easter themes)
- Advanced filtering and search capabilities
- Drag-and-drop file uploads
- Image sequence galleries
- AI-powered story generation
- Tag and keyword management
- PWA support with iOS share target integration
- Direct image and link sharing from iPhone apps

## Data Flow

1. **Content Upload**: Users upload images/create entries through the create page
2. **Processing**: Images are processed and stored locally, metadata saved to database
3. **Organization**: Content is categorized by type, tagged, and can be customized
4. **Discovery**: Users browse content through various filtered views (artists, tags, titles)
5. **AI Integration**: OpenAI API generates stories based on user prompts
6. **Image Processing**: Replicate API handles advanced image operations

## External Dependencies

### Core Dependencies
- **Database**: PostgreSQL with Neon serverless connector
- **UI Components**: Radix UI primitives, Lucide React icons
- **File Processing**: Multer for uploads, Sharp for image processing
- **API Services**: OpenAI for text generation, Replicate for image processing

### Development Tools
- **Build Tools**: Vite, esbuild for production builds
- **Type Safety**: TypeScript with strict configuration
- **Schema Validation**: Zod for runtime type checking
- **Database Migration**: Drizzle Kit for schema management

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with tsx for TypeScript execution
- **Hot Reload**: Vite dev server with HMR
- **Database**: PostgreSQL 16 module in Replit
- **Port Configuration**: Development on port 5000, production on port 80

### Production Build
- **Frontend**: Vite builds to `dist/public` directory
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Static Serving**: Express serves built frontend files
- **Deployment Target**: Replit autoscale deployment

### Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- OpenAI API key for AI features
- File upload limits set to 50MB
- CORS and security headers configured

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 15, 2025. Initial setup
- January 13, 2025. Added iOS share functionality with PWA support for direct image and link sharing from iPhone