# AgriSense

Web and mobile application for agricultural sensing and management.

## Project Structure

```
AgriSense/
├── backend/    # Node.js/Express + MongoDB backend
├── web/        # React web app (Vite)
├── mobile/     # React Native mobile app (Expo)
└── firmware/   # Arduino/ESP32 firmware code (.ino)
```

## Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- MongoDB (local or MongoDB Atlas)
- Expo Go app (for mobile development)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file (already created)
   - Update `MONGODB_URI` if using MongoDB Atlas

4. Start the backend server:
   ```bash
   npm start
   ```
   The server will run on http://localhost:5000

### Web App Setup

1. Navigate to the web directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Mobile App Setup

1. Navigate to the mobile directory:
   ```bash
   cd mobile
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npm start
   ```
   Then scan the QR code with the Expo Go app on your mobile device.

## Tech Stack

- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Web**: React (Vite)
- **Mobile**: React Native (Expo)
