# Excel Mastery Quiz App

A comprehensive Excel quiz application built with Next.js and Firebase, designed to test and improve Excel skills through interactive quizzes and personalized learning recommendations.

## 🚀 Features

### Core Quiz System
- **Interactive Quiz Flow**: Single-question-at-a-time interface with progress tracking
- **Multiple Choice Questions**: Support for text and image-based questions
- **Instant Feedback**: Immediate results with correct/incorrect indicators
- **Category-Based Scoring**: Track performance across different Excel topics

### Personalized Learning
- **Smart Recommendations**: Get training materials based on weak categories
- **Progress Tracking**: Monitor improvement over time with performance charts
- **Category Analysis**: Detailed breakdown of strengths and areas for improvement

### User Management
- **Google Authentication**: Secure sign-in with Google accounts
- **Progress Dashboard**: View quiz history and performance metrics
- **Personalized Experience**: Tailored content based on user performance

### Admin Features
- **Content Management**: Easy question and material management
- **CSV Import**: Bulk import questions and training materials
- **User Analytics**: Track user engagement and performance

## 🛠️ Tech Stack

### Frontend
- **Next.js 15** with App Router
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Hook Form** for form management
- **Chart.js** for data visualization

### Backend & Database
- **Firebase Authentication** for user management
- **Cloud Firestore** for data storage
- **Firebase Storage** for media files
- **Firebase Hosting** for deployment

### Development Tools
- **ESLint** for code quality
- **TypeScript** for type safety
- **Git** for version control

## 📦 Installation

### Prerequisites
- Node.js (version 18 or higher)
- Firebase project with Authentication and Firestore enabled
- Firebase CLI installed globally

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd excel-quiz-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase configuration**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Authentication (Google provider)
   - Enable Firestore database
   - Enable Storage (optional, for training materials)
   - Copy your Firebase configuration from Project Settings > General

4. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```

5. **Configure environment variables**
   Edit `.env.local` with your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

6. **Set up Firestore security rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Visit [http://localhost:3000](http://localhost:3000)

## 🏗️ Project Structure

```
excel-quiz-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout with auth context
│   │   ├── page.tsx           # Home page
│   │   ├── quiz/              # Quiz flow pages
│   │   │   ├── page.tsx       # Main quiz interface
│   │   │   └── results/       # Quiz results and analytics
│   │   │       └── page.tsx   # Results page
│   │   └── api/               # API routes (future)
│   ├── components/            # Reusable components
│   ├── lib/                   # Firebase config and utilities
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript interfaces
│   ├── data/                  # Sample data and CSV processing
│   └── styles/                # Global styles
├── functions/                 # Firebase Cloud Functions (future)
├── public/                    # Static assets
├── firebase.json              # Firebase configuration
├── firestore.rules           # Firestore security rules
└── README.md                 # This file
```

## 🎯 Usage

### Taking a Quiz
1. Sign in with your Google account
2. Click "Start Quiz" on the home page
3. Answer questions one at a time
4. Review your results and get personalized recommendations

### Admin Features (Future)
- Upload CSV files with questions
- Manage training materials
- View user analytics
- Configure quiz settings

## 📊 Database Schema

### Users Collection
```typescript
interface User {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  totalScore: number
  quizAttempts: number
  lastActive: Date
  weakCategories: string[]
}
```

### Questions Collection
```typescript
interface Question {
  id: string
  text: string
  category: 'Formulas' | 'Shortcuts' | 'Charts' | 'DataAnalysis' | 'Formatting'
  options: string[]
  correctAnswer: number
  difficulty: 1 | 2 | 3 | 4 | 5
  imageUrl?: string
}
```

### QuizAttempts Collection
```typescript
interface QuizAttempt {
  id: string
  userId: string
  date: Date
  score: number
  totalQuestions: number
  correctAnswers: number
  categoryScores: Record<string, number>
  wrongCategories: string[]
}
```

## 🚀 Deployment

### Firebase Hosting
1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase Hosting**
   ```bash
   firebase deploy --only hosting
   ```

3. **Your app will be available at**
   `https://your-project-id.web.app`

### Custom Domain
1. Go to Firebase Console > Hosting
2. Add your custom domain
3. Update DNS settings as instructed
4. Deploy again

## 🔧 Development

### Adding Questions
1. **Via CSV Import (Future)**
   - Create a CSV file with question data
   - Use the admin interface to import

2. **Manually in Firestore**
   - Go to Firebase Console > Firestore
   - Add documents to the `questions` collection

### Adding Training Materials
1. **Via Admin Interface (Future)**
   - Use the content management system

2. **Manually in Firestore**
   - Add documents to the `trainingMaterials` collection

### Customizing Styling
- Edit `src/styles/globals.css` for global styles
- Use Tailwind classes in components
- Excel theme colors are defined in CSS custom properties

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 TODO List

### MVP Features (Completed ✅)
- [x] User authentication with Google
- [x] Basic quiz interface
- [x] Question randomization
- [x] Score tracking
- [x] Results page with recommendations
- [x] Progress visualization

### Phase 2 Features (Next)
- [ ] CSV import functionality
- [ ] Admin content management interface
- [ ] Advanced recommendation engine
- [ ] User progress dashboard
- [ ] Training material library

### Phase 3 Features (Future)
- [ ] Multi-language support
- [ ] Advanced analytics and reporting
- [ ] Integration with external Excel resources
- [ ] Mobile app version
- [ ] Corporate training features

## 🐛 Troubleshooting

### Common Issues

**Firebase Authentication not working**
- Ensure Google Authentication is enabled in Firebase Console
- Check that your authDomain matches your Firebase project

**Firestore rules blocking access**
- Verify security rules are deployed
- Check that user authentication is working

**Build errors**
- Ensure all environment variables are set
- Check Node.js version compatibility

### Getting Help
- Check the [Firebase Documentation](https://firebase.google.com/docs)
- Review [Next.js Documentation](https://nextjs.org/docs)
- Create an issue in this repository

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/) and [Firebase](https://firebase.google.com/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Charts powered by [Chart.js](https://www.chartjs.org/)

---

**Questions?** Check the [Issues](../../issues) or [Discussions](../../discussions) sections, or create a new issue for support.