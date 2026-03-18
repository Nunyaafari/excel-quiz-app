# GitHub Setup Guide

Follow these steps to push your Excel Quiz App to GitHub and set it up for collaboration.

## 🚀 Quick Start

### 1. Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `excel-quiz-app`
3. Choose visibility (Public or Private)
4. **⚠️ DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### 2. Push to GitHub

Run these commands in your terminal:

```bash
# Navigate to your project directory
cd excel-quiz-app

# Add your GitHub remote (replace YOUR_USERNAME with your actual GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/excel-quiz-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Verify Push

Visit `https://github.com/YOUR_USERNAME/excel-quiz-app` to confirm your code is uploaded.

## 🔧 Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Project name: ``
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Configure Authentication

1. In Firebase Console, go to **Authentication** > **Sign-in method**
2. Enable **Google** provider
3. Save configuration

### 3. Set Up Firestore

1. Go to **Firestore Database**
2. Click "Create database"
3. Start in **test mode** (for development)
4. Choose location (e.g., `nam5 (us-central)`)

### 4. Configure Web App

1. Go to **Project Settings** > **General**
2. Scroll to "Your apps" and click "Web" (</>)
3. App nickname: `excel-quiz-app`
4. Register app
5. Copy the Firebase configuration object

### 5. Environment Variables

1. Create `.env.local` file in your project root
2. Add your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 6. Deploy Firestore Rules

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize: `firebase init`
4. Select "Firestore" and "Hosting"
5. Deploy rules: `firebase deploy --only firestore:rules`

## 🌐 Deployment to Firebase Hosting

### 1. Build and Deploy

```bash
# Build the application
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

### 2. View Your App

Your app will be available at:
- `https://your-project-id.web.app`
- `https://your-project-id.firebaseapp.com`

### 3. Custom Domain (Optional)

1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Enter your domain (e.g., `quiz.yoursite.com`)
4. Follow DNS setup instructions
5. Deploy again: `firebase deploy --only hosting`

## 📝 Next Steps

### 1. Test Your Application

1. Visit your deployed URL
2. Sign in with Google
3. Take the quiz and verify functionality

### 2. Customize Content

1. Add more questions to the quiz
2. Create training materials
3. Customize the Excel theme colors

### 3. Enhance Features

Consider adding these features:
- CSV import for questions
- Admin dashboard
- User progress tracking
- More question categories

### 4. Production Setup

For production deployment:
- Change Firestore from test mode to production rules
- Set up proper security rules
- Enable Google Analytics
- Configure custom domain
- Set up monitoring and error tracking

## 🚨 Important Notes

### Security
- Never commit `.env.local` to GitHub
- Use environment variables for sensitive data
- Set up proper Firestore security rules

### Development Workflow
- Create feature branches: `git checkout -b feature/new-feature`
- Commit changes: `git commit -m "Add new feature"`
- Push to GitHub: `git push origin feature/new-feature`
- Create pull requests for code review

### Troubleshooting
- Check Firebase Console for authentication issues
- Verify environment variables are set correctly
- Ensure Firestore rules allow proper access
- Check browser console for JavaScript errors

## 📞 Support

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [GitHub Issues](../../issues) for project-specific questions

---

**🎉 Congratulations!** Your Excel Quiz App is now live and ready for users!