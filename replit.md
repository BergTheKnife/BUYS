# BUYS - Build Up Your Store

## Overview

BUYS (Build Up Your Store) is a comprehensive business management system designed for small clothing retailers to manage inventory, sales, expenses, and financial tracking. The application provides a complete solution for business owners to track their products with sizes and images, record sales transactions with quantity control, monitor expenses with automatic inventory cost tracking, and analyze their financial performance through an intuitive dashboard interface.

## Recent Changes (August 5, 2025)

### Latest Update - BUYS Rebranding
- **Complete Visual Rebrand**: Updated from "DAVALB" to "BUYS - Build Up Your Store"
- **New Logo Design**: Created modern gradient logo with brand messaging integration
- **Comprehensive UI Updates**: Updated all navigation, welcome pages, and dashboard branding
- **Brand Consistency**: Applied new branding across login, registration, mobile menu, and main interface

### Previous Updates

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

- **User management** with secure password hashing using bcrypt
- **Inventory tracking** with product details, quantities, and image storage
- **Sales recording** with automatic margin calculation and inventory updates
- **Expense management** with categorization and date tracking
- **Relational data integrity** using foreign key constraints and cascade deletions

### Authentication & Authorization
Authentication is implemented using:

- **Session-based authentication** with secure cookie configuration
- **Password hashing** using bcrypt for secure credential storage
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

### Data Management
- **React Query (TanStack Query)** - Server state management and caching
- **React Hook Form** - Form handling and validation
- **Zod** - Schema validation library

### File Handling
- **Multer** - Multipart/form-data handling for file uploads
- **Node.js fs module** - File system operations

The architecture prioritizes type safety, scalability, and maintainability while providing a smooth user experience for business management tasks.