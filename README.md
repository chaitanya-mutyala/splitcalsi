# SplitCalsi 💸

SplitCalsi is a simple, modern, and production-ready expense-splitting web application designed around User IDs and Group IDs (inspired by Splitwise, but without the phone number hassle). It features a sleek glassmorphism UI with both dark and light mode support.

## 🚀 Features

- **Authentication**: Secure Signup, Login, and Session management via Supabase Auth.
- **Unique User Profiles**: Every user gets a unique, shareable User ID (e.g., `SF-A72KQ9`).
- **Group Management**: 
  - Create groups and get a unique Group ID.
  - Join groups via ID or shareable link.
  - Admins can manually add members using their User ID.
  - Admins can remove members.
- **Expense Tracking**:
  - Add expenses and select who paid.
  - Support for **Equal Splits** and **Exact Amount Splits**.
  - Participants can be manually toggled via checkboxes.
- **Classic Balances Engine**:
  - **Pairwise debt calculation**: Automatically calculates exactly who owes who, preventing inaccurate global netting.
  - Independent Group balances and Global net balances available on the dashboard.
- **Settlements**: Record partial or full payments to clear debts instantly.
- **Modern UI**: Fully responsive, mobile-first glassmorphic design built with Tailwind CSS.

## 🛠️ Tech Stack

- **Frontend**: React (Vite), React Router, Tailwind CSS v3.
- **Backend & Database**: Supabase (PostgreSQL, Row Level Security, RPC Functions).

## 💻 Local Setup

1. **Clone the repository and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Database Setup (Supabase SQL Editor):**
   You need to run the following SQL scripts in your Supabase project in this exact order:
   - Run the initial schema to create tables and triggers: `supabase/schema.sql`
   - Run the RLS fix to prevent recursion: `supabase/fix_rls.sql`
   - Run the final RPC functions for group management: `supabase/phase4_fixes.sql`

4. **Start the development server:**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173` to see the app running!

## 🔒 Security Architecture

SplitCalsi relies heavily on **Supabase Row Level Security (RLS)** to protect user data. 
- You can only see profiles of users you share a group with.
- You can only view expenses, members, and balances of groups you belong to.
- Remote Procedure Calls (RPCs) are strictly utilized to safely execute high-privilege operations (like an Admin adding a user) without exposing database queries.
