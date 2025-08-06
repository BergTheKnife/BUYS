# BUYS - Build Up Your Store

## Overview

BUYS (Build Up Your Store) is a comprehensive business management system designed for small clothing retailers to manage inventory, sales, expenses, and financial tracking. The application provides a complete solution for business owners to track their products with sizes and images, record sales transactions with quantity control, monitor expenses with automatic inventory cost tracking, and analyze their financial performance through an intuitive dashboard interface. Features secure multi-activity support and comprehensive email verification system for enhanced security.

## Recent Changes (August 6, 2025)

### Latest Update - Complete Email Verification System with Resend Functionality
- **EMAIL VERIFICATION REQUIRED**: All new user registrations now require email verification before account activation
- **Comprehensive Email System**: Implemented complete SMTP integration with nodemailer for verification and welcome emails
- **Token-based Verification**: Secure 64-character hex tokens with 24-hour expiration for email verification process
- **Database Schema Updates**: Added email_verification_tokens table and enhanced users table with email_verified and is_active columns
- **Frontend Integration**: Updated welcome page to handle verification messages and user feedback for unverified accounts
- **Account Security**: Users with unverified accounts cannot access the system until they click the email verification link
- **Professional Email Templates**: HTML email templates for verification and welcome messages with BUYS branding
- **Token Management**: Automatic cleanup of expired tokens and secure token deletion after successful verification
- **Email Resend Feature**: Added resend verification email functionality for users with unverified accounts
- **Enhanced UX**: Login attempts with unverified accounts now show prominent resend button with loading states
- **Smart Redirect**: Email verification links redirect to app login with success toast notifications

### Previous Update - Multi-Activity System Implementation
- **Complete Multi-Activity Architecture**: Implemented comprehensive database schema with activities and user_activities tables
- **Activity-Based Data Isolation**: All inventory, sales, expenses, and statistics are now activity-specific rather than user-specific
- **Activity Management System**: Added complete activity creation, joining, and switching functionality
- **Session Management**: Enhanced session system to track both user authentication and current activity context
- **Database Migration**: Successfully migrated existing data with manual SQL approach to preserve all records
- **Server Route Updates**: Completely refactored all API endpoints to use activity context instead of user context
- **Activity Authentication**: Implemented requireActivity middleware to ensure proper activity access control
- **Activity Selection Flow**: Added activity selection page for managing multiple business entities within single user account

### Previous Updates - Chart.js Implementation & Financial Analytics
- **Chart.js Integration**: Successfully implemented Chart.js with react-chartjs-2 for financial data visualization
- **Balance Page Enhancement**: Added comprehensive charts to the Balance/Bilancio page showing 6-month financial trends
- **Interactive Chart Types**: Implemented both line charts and bar charts with toggle functionality
- **Financial Trend Analysis**: Charts display Sales, Expenses, and Margin data over the last 6 months
- **Real-time Data Integration**: Charts use authentic data from the database through new /api/chart-data endpoint
- **Professional Visualization**: Charts include proper currency formatting, legends, and responsive design
- **Logo System**: Dual logo implementation - white logo for navbar, colorful logo for login/registration and mobile menu
- **Enhanced Authentication System**: Real-time username validation, password requirements (6+ chars, uppercase, number), Google OAuth integration placeholder
- **Username Management**: Added ability to change username within the app with uniqueness validation
- **Advanced UI Improvements**: Comprehensive filters for expenses page, chart view toggles for balance section, enhanced sales filtering
- **Password Security**: Strengthened password requirements with visual hints and validation feedback
- **User Experience**: Real-time feedback for username availability, improved form validation across all modules
- **Cross-module Integration**: Enhanced filtering and data display capabilities across dashboard, sales, expenses, and balance modules

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The frontend is built using **React 18** with **TypeScript** in a single-page application (SPA) architecture. The application uses **Vite** as the build tool for fast development and optimized production builds. Key architectural decisions include:

- **Component-based architecture** using functional components with React Hooks
- **Client-side routing** implemented with Wouter for lightweight navigation
- **State management** handled through React Query for server state and React Context for authentication
- **UI components** built with Radix UI primitives and styled using Tailwind CSS
- **Form handling** implemented with React Hook Form and Zod validation schemas

### Backend Architecture
The backend follows a **RESTful API** design built on **Node.js** with **Express.js**. The architecture emphasizes:

- **MVC pattern** with separate route handlers, storage layer, and business logic
- **Session-based authentication** using express-session with secure cookie configuration
- **File upload handling** using Multer for product images with size and type validation
- **Modular route organization** separating concerns across different business domains
- **Error handling middleware** for consistent API response formatting

### Database Architecture
The application uses **PostgreSQL** as the primary database with **Drizzle ORM** for type-safe database operations. The schema design includes:

- **User management** with secure password hashing using bcrypt and email verification system
- **Email verification tokens** with secure token generation and expiration management
- **Activity-based data organization** with complete data isolation between business entities
- **Inventory tracking** with product details, quantities, and image storage
- **Sales recording** with automatic margin calculation and inventory updates
- **Expense management** with categorization and date tracking
- **Relational data integrity** using foreign key constraints and cascade deletions

### Authentication & Authorization
Authentication is implemented using:

- **Session-based authentication** with secure cookie configuration
- **Password hashing** using bcrypt for secure credential storage
- **Email verification system** with secure token-based verification for all new registrations
- **SMTP integration** using nodemailer for email delivery with configurable SMTP settings
- **Account activation control** preventing unverified users from accessing the system
- **Protected routes** with middleware validation on both client and server
- **User context management** for maintaining authentication state across the application

### File Management
The system handles file uploads for product images:

- **Local file storage** with organized directory structure
- **File type validation** restricting uploads to image formats only
- **Size limitations** preventing oversized file uploads
- **Static file serving** for uploaded images through Express middleware

## External Dependencies

### Database
- **Neon Database** - PostgreSQL-compatible serverless database service
- **Drizzle ORM** - Type-safe database toolkit with PostgreSQL driver

### UI Framework
- **Radix UI** - Comprehensive set of accessible, unstyled UI components
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Lucide React** - Icon library for consistent iconography

### Development Tools
- **Vite** - Fast build tool and development server
- **TypeScript** - Type safety and enhanced developer experience
- **ESBuild** - Fast JavaScript bundler for production builds

### Authentication & Security
- **bcrypt** - Password hashing library
- **express-session** - Session management middleware  
- **connect-pg-simple** - PostgreSQL session store
- **nodemailer** - SMTP email delivery for verification and notifications
- **crypto** - Secure token generation for email verification

### Data Management
- **React Query (TanStack Query)** - Server state management and caching
- **React Hook Form** - Form handling and validation
- **Zod** - Schema validation library

### File Handling
- **Multer** - Multipart/form-data handling for file uploads
- **Node.js fs module** - File system operations

The architecture prioritizes type safety, scalability, and maintainability while providing a smooth user experience for business management tasks.