# Al-Mustashar - AI Chat Application

Al-Mustashar is a feature-rich, AI-powered chat application built with React Native and Expo. It leverages the power of the OpenAI API for intelligent chat completions and DALL-E for image generation. The backend is powered by Supabase, providing robust authentication, database, and storage solutions.

## Key Features

### Core Functionality
- **AI Chat:** Engage in intelligent conversations with a GPT-powered chatbot using the OpenAI API.
- **DALL-E Image Generation:** Create unique images from textual descriptions.
- **Chat History:** All conversations are saved locally on the device using Expo SQLite for offline access.
- **Contextual Conversations:** The application maintains conversation context, allowing for more natural and coherent interactions.
- **Streaming Responses:** Messages from the AI are streamed in real-time for a more dynamic user experience.

### Backend & Authentication
- **Supabase Integration:** Utilizes Supabase for a complete backend solution.
  - **Authentication:** Secure user login and management.
  - **Database:** Storing user data and application state.
  - **Storage:** Saving generated images and other assets.
- **Expo Secure Store:** Securely stores sensitive user information and tokens.

### UI/UX
- **Expo Router:** Implements file-based navigation for a clean and organized routing structure.
- **Advanced Animations:** Smooth and engaging animations powered by Reanimated and Gesture Handler.
- **Native UI Components:** Uses Zeego to provide native menus for a seamless platform-specific feel.
- **Optimized Lists:** Employs Shopify's FlashList for efficient rendering of long conversation lists.
- **Image Zoom:** In-app image viewer with zoom and pan capabilities.
- **Loading Skeletons:** Shimmer placeholders provide a better loading experience.

### Performance
- **MMKV Storage:** High-performance key/value storage for quick data access.
- **Sentry Error Tracking:** Integrated for monitoring and debugging in production.

## Project Structure

The project follows the standard Expo Router layout for organizing routes and components:

- `app/`: Contains all the application routes.
  - `(auth)/`: Group for authentication-related screens (login, onboarding).
  - `(drawer)/`: Main application screens accessible via a drawer navigator.
    - `(chat)/`: Screens for creating and managing chats.
    - `dalle.tsx`: The DALL-E image generation interface.
    - `explore.tsx`: A screen for discovering features.
  - `(modal)/`: Screens presented modally (e.g., Settings, Profile).
- `components/`: Reusable UI components used throughout the application.
- `constants/`: Global styles and color definitions.
- `contexts/`: React contexts for state management (e.g., AuthContext).
- `supabase/`: Configuration and serverless functions for the Supabase backend.
- `utils/`: Helper functions and utility classes.

## Getting Started

### Prerequisites
- Node.js (LTS version recommended)
- Expo CLI
- A Supabase account for backend services
- An OpenAI API key

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/rhino257/al-mustashar-app.git
    cd al-mustashar-app
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root of the project and add your Supabase and OpenAI credentials:
    ```
    EXPO_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
    OPENAI_API_KEY=YOUR_OPENAI_API_KEY
    ```

4.  **Run the application:**
    ```bash
    npx expo start
    ```
    This will start the Metro bundler. You can then run the app on an iOS simulator, Android emulator, or on your physical device using the Expo Go app.



This project is licensed under the [MIT License](./LICENSE).
