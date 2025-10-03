# BUYS - Build Up Your Store

## Overview
BUYS (Build Up Your Store) is a comprehensive business management system designed for small retailers and makers. It provides a complete solution for managing inventory, production, sales, expenses, and financial tracking. Key capabilities include product tracking with sizes and images, production material management with batch tracking, showcase products (Vetrina) with BOM (Bill of Materials), sales from both inventory and production (Vetrina), expense monitoring with automatic inventory cost tracking, and financial performance analysis. The application features secure multi-activity support, a robust email verification system, "remember me" auto-login, and configurable store profiles with feature flags (production, vetrina, variants, serials, lots_expiry, shipping, services, digital).

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is a single-page application (SPA) built with **React 18** and **TypeScript**, using **Vite** as the build tool. It employs a component-based architecture with functional components and React Hooks. **Wouter** handles client-side routing, while **React Query** manages server state and **React Context** handles authentication state. UI components are built with **Radix UI** primitives and styled using **Tailwind CSS**. Form handling utilizes **React Hook Form** with **Zod** for validation.

### Backend Architecture
The backend is a **RESTful API** developed with **Node.js** and **Express.js**, following an MVC pattern. It uses **session-based authentication** with secure cookies via `express-session` and `connect-pg-simple`. File uploads for product images are handled by **Multer**, including size and type validation. The architecture features modular route organization and robust error handling middleware.

### Database Architecture
**PostgreSQL** is the primary database, managed with **Drizzle ORM** for type-safe operations. The schema supports user management (with bcrypt password hashing and email verification), secure email verification tokens, and activity-based data organization to isolate business entities. It includes comprehensive tracking for inventory (products, quantities, images), sales (with margin calculation and inventory updates), and expenses (categorization, date tracking). Relational data integrity is enforced with foreign key constraints. A critical data protection system prevents accidental data loss by blocking deletion of users/activities associated with business data and implementing automatic backups before deletions, along with comprehensive audit logging.

**Production & Vetrina Accounting**: The system implements intelligent material consumption tracking with two ordering strategies:
- **FIFO (First-In-First-Out)**: Default ordering by purchase date when `lots_expiry=false`
- **FEFO (First-Expired-First-Out)**: Priority ordering by expiry date (nulls last) then purchase date when `lots_expiry=true`

When a vetrina (showcase) product is sold, materials are consumed from batches according to the configured strategy, and each consumption is linked to the specific inventory item via `inventory_id` in the `production_consumptions` table. The vetrina sale flow creates an auto-generated inventory item (with `vetrina_id` reference), consumes materials, and records consumptions with the inventory item's ID.

**Critical Accounting Rule for Vetrina Sale Deletion**: When a vetrina sale is deleted, the system does NOT restore consumed materials back to inventory. This matches real-world accounting where materials used in production cannot be "unconsumed". Instead, the system only deletes consumption records, and the inventory item remains in stock with its calculated cost, ready to be sold again. This prevents material double-counting and maintains accurate inventory valuation.

**Material Cost Modification**: Materials support real-time cost updates with automatic accounting. When modifying a material's unit cost, the system:
1. Calculates the cost difference against all remaining batches
2. Updates all batch costs proportionally
3. Creates appropriate financial records:
   - Cost increase: Creates expense using Cassa Reinvestimento first, then personal funds
   - Cost decrease: Creates refund to Cassa Reinvestimento first, then personal funds
4. Provides visual feedback in the UI (red indicator for increases, green for decreases)

### Authentication & Authorization
Authentication relies on **session-based authentication** with secure cookies. Passwords are hashed using **bcrypt**. A robust **email verification system** uses secure, token-based verification via **nodemailer** for all new registrations, preventing unverified users from accessing the system. Protected routes are enforced through client and server-side middleware. An auto-login "remember me" system allows users to stay logged in for up to 30 days using secure HTTP-only cookies and a `remember_tokens` database table.

### File Management
The system handles product image uploads, storing them locally with an organized directory structure. It enforces file type validation (image formats only) and size limitations. Uploaded images are served statically via Express middleware.

### UI/UX Decisions
The application features a mobile-friendly design, specifically optimized for iPhone, with PWA capabilities for "Add to Home Screen" functionality, custom app icons, and a comprehensive dashboard. It includes real-time validation feedback, advanced filtering options for various modules, and a dual-logo system for consistent branding across different parts of the application. The Balance/Bilancio page integrates **Chart.js** with `react-chartjs-2` for interactive financial data visualizations (line and bar charts) displaying 6-month trends for sales, expenses, and margin.

## External Dependencies

### Database
- **Neon Database**: PostgreSQL-compatible serverless database service.
- **Drizzle ORM**: Type-safe database toolkit for PostgreSQL.

### UI Framework
- **Radix UI**: Accessible, unstyled UI components.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

### Development Tools
- **Vite**: Fast build tool and development server.
- **TypeScript**: For type safety.
- **ESBuild**: Fast JavaScript bundler.

### Authentication & Security
- **bcrypt**: Password hashing.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **nodemailer**: SMTP email delivery.
- **crypto**: Secure token generation.

### Data Management
- **React Query (TanStack Query)**: Server state management and caching.
- **React Hook Form**: Form handling and validation.
- **Zod**: Schema validation.
- **Chart.js**: Data visualization.
- **react-chartjs-2**: React wrapper for Chart.js.

### File Handling
- **Multer**: Multipart/form-data handling.
- **Node.js fs module**: File system operations.