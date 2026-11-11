import type { Language } from '../types';

export interface Translations {
  nav: {
    catalog: string;
    desktop: string;
    android: string;
    extensions: string;
    admin: string;
  };
  hero: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    exploreCta: string;
    verifiedNote: string;
  };
  filters: {
    all: string;
    windows: string;
    android: string;
    chrome: string;
    macos: string;
    crossPlatform: string;
  };
  catalog: {
    featuredTitle: string;
    allSoftwareTitle: string;
    emptyTitle: string;
    emptySubtitle: string;
    freeLabel: string;
    downloadsLabel: string;
    viewDetails: string;
    noSearchResults: string;
    clearFilters: string;
  };
  details: {
    backToCatalog: string;
    fileSize: string;
    version: string;
    platform: string;
    lastUpdated: string;
    totalDownloads: string;
    fileFormat: string;
    directDownload: string;
    downloading: string;
    downloadStarted: string;
    zeroSpamNote: string;
    installGuideTitle: string;
    defaultGuides: {
      Windows: string[];
      Android: string[];
      Chrome: string[];
      macOS: string[];
      'Cross-Platform': string[];
    };
    couponLabel: string;
    couponPlaceholder: string;
    applyCoupon: string;
    removeCoupon: string;
    couponApplied: string;
    couponInvalid: string;
    couponExpired: string;
    couponLimitReached: string;
    couponNotApplicable: string;
    originalPrice: string;
    finalPrice: string;
    notFoundTitle: string;
    notFoundSubtitle: string;
  };
  admin: {
    title: string;
    subtitle: string;
    signInTitle: string;
    signInSubtitle: string;
    signInGoogle: string;
    orEmail: string;
    emailLabel: string;
    passwordLabel: string;
    signInEmail: string;
    signOut: string;
    unauthorizedTitle: string;
    unauthorizedSubtitle: string;
    stats: {
      totalDownloads: string;
      activePackages: string;
      activeCoupons: string;
      recentEvents: string;
    };
    tabs: {
      software: string;
      coupons: string;
      analytics: string;
    };
    seedStarter: string;
    addSoftware: string;
    editSoftware: string;
    saveSoftware: string;
    cancel: string;
    archive: string;
    restore: string;
    delete: string;
    addCoupon: string;
    createCoupon: string;
    scopeAll: string;
    scopeSpecific: string;
    active: string;
    archived: string;
    inactive: string;
  };
  footer: {
    tagline: string;
    rights: string;
    directDistribution: string;
  };
}

export const translations: Record<Language, Translations> = {
  en: {
    nav: {
      catalog: 'Catalog',
      desktop: 'Desktop',
      android: 'Android',
      extensions: 'Extensions',
      admin: 'Admin',
    },
    hero: {
      title: 'Verified software, apps, and browser extensions.',
      subtitle:
        'Direct, clean distribution for Windows utilities, Android APKs, and productivity extensions—built for speed with zero adware or redirect clutter.',
      searchPlaceholder: 'Search software, APKs, or extensions...',
      exploreCta: 'Browse Catalog',
      verifiedNote: 'Checksum-checked builds · Direct downloads',
    },
    filters: {
      all: 'All Platforms',
      windows: 'Windows',
      android: 'Android',
      chrome: 'Chrome',
      macos: 'macOS',
      crossPlatform: 'Cross-Platform',
    },
    catalog: {
      featuredTitle: 'Featured Releases',
      allSoftwareTitle: 'Software Directory',
      emptyTitle: 'No software packages published yet',
      emptySubtitle:
        'Sign in to the Admin console to publish your first desktop program, Android APK, or browser extension.',
      freeLabel: 'Free',
      downloadsLabel: 'downloads',
      viewDetails: 'View & Download',
      noSearchResults: 'No packages match your current search or platform filter.',
      clearFilters: 'Reset filters',
    },
    details: {
      backToCatalog: 'Back to Catalog',
      fileSize: 'File Size',
      version: 'Version',
      platform: 'Target Platform',
      lastUpdated: 'Last Updated',
      totalDownloads: 'Total Downloads',
      fileFormat: 'Package Type',
      directDownload: 'Direct Download',
      downloading: 'Preparing download...',
      downloadStarted: 'Download started — thank you for using Toolpotro.',
      zeroSpamNote: 'Direct link · Zero redirects or bundled installers',
      installGuideTitle: 'Installation Guide',
      defaultGuides: {
        Windows: [
          'Download the installer (.exe) or archive (.zip) using the Direct Download button.',
          'If packaged as a .zip archive, right-click and select "Extract All" to a clean folder.',
          'Run the executable as Administrator if prompted by Windows User Account Control.',
          'Follow the on-screen setup wizard to complete installation.',
        ],
        Android: [
          'Download the signed .apk package directly to your Android device.',
          'Open Settings → Security & Privacy → Install unknown apps, and allow your browser or file manager.',
          'Tap the downloaded .apk file from your Notifications or Downloads folder.',
          'Tap "Install" and launch the application once verification finishes.',
        ],
        Chrome: [
          'Click Direct Download to open the official store listing or download the extension .zip package.',
          'If installing a .zip bundle, extract it and open chrome://extensions in your browser.',
          'Enable "Developer mode" in the top-right corner of the Extensions page.',
          'Click "Load unpacked" and select the extracted folder to activate the extension.',
        ],
        macOS: [
          'Download the macOS package and extract the .zip archive if applicable.',
          'Drag the application bundle into your Applications folder.',
          'Right-click the app icon and select "Open" on first launch to verify Gatekeeper.',
        ],
        'Cross-Platform': [
          'Download the distribution bundle for your operating system.',
          'Extract the archive and review the included README for environment requirements.',
          'Launch the binary or load the package in your target runtime.',
        ],
      },
      couponLabel: 'Have a promo or license coupon?',
      couponPlaceholder: 'Enter coupon code (e.g. LAUNCH25)',
      applyCoupon: 'Apply',
      removeCoupon: 'Remove',
      couponApplied: 'Coupon applied successfully',
      couponInvalid: 'Invalid or inactive coupon code.',
      couponExpired: 'This coupon code has expired.',
      couponLimitReached: 'This coupon has reached its usage limit.',
      couponNotApplicable: 'This coupon is not valid for this software.',
      originalPrice: 'Original',
      finalPrice: 'Final Price',
      notFoundTitle: 'Package not found',
      notFoundSubtitle: 'This software item may have been archived or removed.',
    },
    admin: {
      title: 'Toolpotro Admin Console',
      subtitle: 'Manage software releases, dynamic coupons, and real-time download analytics.',
      signInTitle: 'Administrator Sign In',
      signInSubtitle: 'Protected by Firebase Authentication. Only verified admins can modify catalog data.',
      signInGoogle: 'Continue with Google',
      orEmail: 'or sign in with email',
      emailLabel: 'Admin Email',
      passwordLabel: 'Password',
      signInEmail: 'Sign In',
      signOut: 'Sign Out',
      unauthorizedTitle: 'Access Restricted',
      unauthorizedSubtitle: 'Your account is authenticated, but does not have administrator privileges for Toolpotro.',
      stats: {
        totalDownloads: 'Total Downloads',
        activePackages: 'Active Packages',
        activeCoupons: 'Active Coupons',
        recentEvents: 'Logged Events',
      },
      tabs: {
        software: 'Software & Apps',
        coupons: 'Coupon Codes',
        analytics: 'Download Analytics',
      },
      seedStarter: 'Seed Starter Catalog',
      addSoftware: 'Add Software',
      editSoftware: 'Edit Software',
      saveSoftware: 'Save Package',
      cancel: 'Cancel',
      archive: 'Archive',
      restore: 'Restore',
      delete: 'Delete',
      addCoupon: 'New Coupon',
      createCoupon: 'Create Coupon',
      scopeAll: 'All Items',
      scopeSpecific: 'Specific Software',
      active: 'Active',
      archived: 'Archived',
      inactive: 'Inactive',
    },
    footer: {
      tagline: 'Clean, direct software distribution for desktop, mobile, and browser.',
      rights: 'All rights reserved.',
      directDistribution: 'Verified Direct Distribution',
    },
  },

  bn: {
    nav: {
      catalog: 'ক্যাটালগ',
      desktop: 'ডেস্কটপ',
      android: 'অ্যান্ড্রয়েড',
      extensions: 'এক্সটেনশন',
      admin: 'অ্যাডমিন',
    },
    hero: {
      title: 'ভেরিফায়েড সফটওয়্যার, অ্যাপ এবং ব্রাউজার এক্সটেনশন।',
      subtitle:
        'উইন্ডোজ টুলস, অ্যান্ড্রয়েড APK এবং ব্রাউজার এক্সটেনশনের জন্য সরাসরি ও নিরাপদ ডাউনলোড প্ল্যাটফর্ম—কোনো স্প্যাম বা বিভ্রান্তিকর রিডাইরেক্ট ছাড়াই।',
      searchPlaceholder: 'সফটওয়্যার, APK বা এক্সটেনশন খুঁজুন...',
      exploreCta: 'ক্যাটালগ দেখুন',
      verifiedNote: 'যাচাইকৃত বিল্ড · সরাসরি ডাউনলোড',
    },
    filters: {
      all: 'সব প্ল্যাটফর্ম',
      windows: 'উইন্ডোজ',
      android: 'অ্যান্ড্রয়েড',
      chrome: 'ক্রোম',
      macos: 'ম্যাকওএস',
      crossPlatform: 'ক্রস-প্ল্যাটফর্ম',
    },
    catalog: {
      featuredTitle: 'নির্বাচিত রিলিজ',
      allSoftwareTitle: 'সফটওয়্যার ডিরেক্টরি',
      emptyTitle: 'এখনো কোনো সফটওয়্যার যুক্ত করা হয়নি',
      emptySubtitle:
        'আপনার প্রথম ডেস্কটপ প্রোগ্রাম, অ্যান্ড্রয়েড APK বা এক্সটেনশন প্রকাশ করতে অ্যাডমিন কনসোলে সাইন ইন করুন।',
      freeLabel: 'ফ্রি',
      downloadsLabel: 'ডাউনলোড',
      viewDetails: 'বিস্তারিত ও ডাউনলোড',
      noSearchResults: 'আপনার খোঁজা বা ফিল্টারের সাথে কোনো সফটওয়্যার মেলেনি।',
      clearFilters: 'ফিল্টার রিসেট করুন',
    },
    details: {
      backToCatalog: 'ক্যাটালগে ফিরে যান',
      fileSize: 'ফাইল সাইজ',
      version: 'ভার্সন',
      platform: 'প্ল্যাটফর্ম',
      lastUpdated: 'সর্বশেষ আপডেট',
      totalDownloads: 'মোট ডাউনলোড',
      fileFormat: 'ফাইল ফরম্যাট',
      directDownload: 'সরাসরি ডাউনলোড করুন',
      downloading: 'ডাউনলোড প্রস্তুত হচ্ছে...',
      downloadStarted: 'ডাউনলোড শুরু হয়েছে — টুলপত্র ব্যবহার করার জন্য ধন্যবাদ।',
      zeroSpamNote: 'সরাসরি লিংক · কোনো স্প্যাম বা অতিরিক্ত অ্যাডওয়্যার নেই',
      installGuideTitle: 'ইনস্টলেশন গাইড',
      defaultGuides: {
        Windows: [
          'সরাসরি ডাউনলোড বাটনে ক্লিক করে ইনস্টলার (.exe) বা (.zip) ফাইলটি ডাউনলোড করুন।',
          'ফাইলটি .zip ফরম্যাটে থাকলে রাইট-ক্লিক করে "Extract All" দিয়ে ফোল্ডারে আনজিপ করুন।',
          'প্রয়োজনে ইনস্টলারটি Run as Administrator হিসেবে চালু করুন।',
          'স্ক্রিনের নির্দেশনা অনুসরণ করে ইনস্টলেশন সম্পন্ন করুন।',
        ],
        Android: [
          'আপনার অ্যান্ড্রয়েড ফোনে সরাসরি .apk ফাইলটি ডাউনলোড করুন।',
          'Settings → Security → Install unknown apps-এ গিয়ে আপনার ব্রাউজার বা ফাইল ম্যানেজারকে অনুমতি দিন।',
          'নোটিফিকেশন বা Downloads ফোল্ডার থেকে ডাউনলোড করা .apk ফাইলে ট্যাপ করুন।',
          '"Install" বাটনে ট্যাপ করুন এবং ইনস্টল শেষে অ্যাপটি চালু করুন।',
        ],
        Chrome: [
          'অফিশিয়াল স্টোর লিংক বা এক্সটেনশন .zip ফাইল পেতে সরাসরি ডাউনলোড বাটনে ক্লিক করুন।',
          '.zip ফাইল হলে সেটি আনজিপ করুন এবং ব্রাউজারে chrome://extensions পেজে যান।',
          'উপরের ডানদিকে থাকা "Developer mode" চালু করুন।',
          '"Load unpacked" ক্লিক করে আনজিপ করা ফোল্ডারটি সিলেক্ট করুন।',
        ],
        macOS: [
          'ম্যাকওএস প্যাকেজটি ডাউনলোড করুন এবং প্রয়োজনে .zip ফাইলটি আনজিপ করুন।',
          'অ্যাপ আইকনটি টেনে আপনার Applications ফোল্ডারে রাখুন।',
          'প্রথমবার ওপেন করার সময় রাইট-ক্লিক করে "Open" সিলেক্ট করুন।',
        ],
        'Cross-Platform': [
          'আপনার অপারেটিং সিস্টেম অনুযায়ী প্যাকেজটি ডাউনলোড করুন।',
          'ফাইলটি আনজিপ করে ভেতরের README নির্দেশিকা দেখুন।',
          'নির্দেশনা অনুযায়ী অ্যাপ্লিকেশনটি চালু করুন।',
        ],
      },
      couponLabel: 'কুপন কোড আছে?',
      couponPlaceholder: 'কুপন কোড লিখুন (যেমন LAUNCH25)',
      applyCoupon: 'প্রয়োগ করুন',
      removeCoupon: 'সরান',
      couponApplied: 'কুপন সফলভাবে প্রয়োগ হয়েছে',
      couponInvalid: 'কুপন কোডটি সঠিক নয় বা নিষ্ক্রিয়।',
      couponExpired: 'এই কুপন কোডের মেয়াদ শেষ হয়ে গেছে।',
      couponLimitReached: 'এই কুপনের ব্যবহারের সীমা শেষ হয়ে গেছে।',
      couponNotApplicable: 'এই কুপনটি এই সফটওয়্যারের জন্য প্রযোজ্য নয়।',
      originalPrice: 'আসল মূল্য',
      finalPrice: 'চূড়ান্ত মূল্য',
      notFoundTitle: 'সফটওয়্যারটি পাওয়া যায়নি',
      notFoundSubtitle: 'এই আইটেমটি আর্কাইভ বা মুছে ফেলা হয়ে থাকতে পারে।',
    },
    admin: {
      title: 'টুলপত্র অ্যাডমিন কনসোল',
      subtitle: 'সফটওয়্যার রিলিজ, ডাইনামিক কুপন এবং ডাউনলোড অ্যানালিটিক্স পরিচালনা করুন।',
      signInTitle: 'অ্যাডমিন সাইন ইন',
      signInSubtitle: 'Firebase Authentication দ্বারা সুরক্ষিত। শুধুমাত্র অনুমোদিত অ্যাডমিনরাই ডেটা পরিবর্তন করতে পারবেন।',
      signInGoogle: 'Google দিয়ে সাইন ইন করুন',
      orEmail: 'অথবা ইমেইল দিয়ে সাইন ইন করুন',
      emailLabel: 'অ্যাডমিন ইমেইল',
      passwordLabel: 'পাসওয়ার্ড',
      signInEmail: 'সাইন ইন',
      signOut: 'সাইন আউট',
      unauthorizedTitle: 'প্রবেশাধিকার সংরক্ষিত',
      unauthorizedSubtitle: 'আপনার অ্যাকাউন্টটি লগইন করা আছে, তবে টুলপত্র অ্যাডমিন প্যানেলের অনুমতি নেই।',
      stats: {
        totalDownloads: 'মোট ডাউনলোড',
        activePackages: 'সক্রিয় সফটওয়্যার',
        activeCoupons: 'সক্রিয় কুপন',
        recentEvents: 'ডাউনলোড লগ',
      },
      tabs: {
        software: 'সফটওয়্যার ও অ্যাপ',
        coupons: 'কুপন কোড',
        analytics: 'ডাউনলোড অ্যানালিটিক্স',
      },
      seedStarter: 'নমুনা ডেটা যুক্ত করুন',
      addSoftware: 'নতুন সফটওয়্যার',
      editSoftware: 'সফটওয়্যার এডিট',
      saveSoftware: 'সেভ করুন',
      cancel: 'বাতিল',
      archive: 'আর্কাইভ',
      restore: 'পুনরুদ্ধার',
      delete: 'মুছুন',
      addCoupon: 'নতুন কুপন',
      createCoupon: 'কুপন তৈরি করুন',
      scopeAll: 'সব আইটেম',
      scopeSpecific: 'নির্দিষ্ট সফটওয়্যার',
      active: 'সক্রিয়',
      archived: 'আর্কাইভড',
      inactive: 'নিষ্ক্রিয়',
    },
    footer: {
      tagline: 'ডেস্কটপ, মোবাইল এবং ব্রাউজারের জন্য নিরাপদ ও সরাসরি সফটওয়্যার বিতরণ।',
      rights: 'সর্বস্বত্ব সংরক্ষিত।',
      directDistribution: 'যাচাইকৃত সরাসরি বিতরণ',
    },
  },

  hi: {
    nav: {
      catalog: 'कैटलॉग',
      desktop: 'डेस्कटॉप',
      android: 'एंड्रॉइड',
      extensions: 'एक्सटेंशन',
      admin: 'एडमिन',
    },
    hero: {
      title: 'सत्यापित सॉफ़्टवेयर, ऐप्स और ब्राउज़र एक्सटेंशन।',
      subtitle:
        'विंडोज़ यूटिलिटीज़, एंड्रॉइड APK और ब्राउज़र एक्सटेंशन के लिए तेज़ और सुरक्षित डायरेक्ट डाउनलोड—बिना किसी स्पैम या रीडायरेक्ट के।',
      searchPlaceholder: 'सॉफ़्टवेयर, APK या एक्सटेंशन खोजें...',
      exploreCta: 'कैटलॉग देखें',
      verifiedNote: 'सत्यापित बिल्ड · डायरेक्ट डाउनलोड',
    },
    filters: {
      all: 'सभी प्लेटफ़ॉर्म',
      windows: 'विंडोज़',
      android: 'एंड्रॉइड',
      chrome: 'क्रोम',
      macos: 'मैकओएस',
      crossPlatform: 'क्रॉस-प्लेटफ़ॉर्म',
    },
    catalog: {
      featuredTitle: 'प्रमुख रिलीज़',
      allSoftwareTitle: 'सॉफ़्टवेयर डायरेक्टरी',
      emptyTitle: 'अभी कोई सॉफ़्टवेयर प्रकाशित नहीं हुआ है',
      emptySubtitle:
        'अपना पहला डेस्कटॉप प्रोग्राम, एंड्रॉइड APK या एक्सटेंशन जोड़ने के लिए एडमिन कंसोल में साइन इन करें।',
      freeLabel: 'निःशुल्क',
      downloadsLabel: 'डाउनलोड',
      viewDetails: 'विवरण और डाउनलोड',
      noSearchResults: 'आपकी खोज या फ़िल्टर से कोई पैकेज मेल नहीं खाता।',
      clearFilters: 'फ़िल्टर रीसेट करें',
    },
    details: {
      backToCatalog: 'कैटलॉग पर वापस जाएं',
      fileSize: 'फ़ाइल आकार',
      version: 'संस्करण',
      platform: 'लक्ष्य प्लेटफ़ॉर्म',
      lastUpdated: 'अंतिम अपडेट',
      totalDownloads: 'कुल डाउनलोड',
      fileFormat: 'पैकेज प्रकार',
      directDownload: 'डायरेक्ट डाउनलोड',
      downloading: 'डाउनलोड तैयार हो रहा है...',
      downloadStarted: 'डाउनलोड शुरू हो गया — Toolpotro उपयोग करने के लिए धन्यवाद।',
      zeroSpamNote: 'सीधा लिंक · कोई स्पैम या अतिरिक्त इंस्टॉलर नहीं',
      installGuideTitle: 'इंस्टॉलेशन गाइड',
      defaultGuides: {
        Windows: [
          'डायरेक्ट डाउनलोड बटन से इंस्टॉलर (.exe) या (.zip) फ़ाइल डाउनलोड करें।',
          'यदि फ़ाइल .zip में है, तो राइट-क्लिक करके "Extract All" चुनें।',
          'आवश्यकता पड़ने पर सेटअप को Run as Administrator के रूप में चलाएं।',
          'इंस्टॉलेशन पूरा करने के लिए स्क्रीन पर दिए गए निर्देशों का पालन करें।',
        ],
        Android: [
          'अपने एंड्रॉइड डिवाइस पर सीधे .apk पैकेज डाउनलोड करें।',
          'Settings → Security → Install unknown apps में जाकर अपने ब्राउज़र या फ़ाइल मैनेजर को अनुमति दें।',
          'नोटिफिकेशन या Downloads फ़ोल्डर से डाउनलोड की गई .apk फ़ाइल पर टैप करें।',
          '"Install" पर टैप करें और सत्यापन के बाद ऐप खोलें।',
        ],
        Chrome: [
          'आधिकारिक स्टोर लिंक या एक्सटेंशन .zip पैकेज के लिए डायरेक्ट डाउनलोड पर क्लिक करें।',
          'यदि .zip बंडल है, तो उसे एक्सट्रैक्ट करें और ब्राउज़र में chrome://extensions खोलें।',
          'ऊपर दाईं ओर "Developer mode" को चालू करें।',
          '"Load unpacked" पर क्लिक करें और एक्सट्रैक्ट किया गया फ़ोल्डर चुनें।',
        ],
        macOS: [
          'macOS पैकेज डाउनलोड करें और यदि आवश्यक हो तो .zip फ़ाइल एक्सट्रैक्ट करें।',
          'ऐप बंडल को अपने Applications फ़ोल्डर में ड्रैग करें।',
          'पहली बार खोलते समय राइट-क्लिक करके "Open" चुनें।',
        ],
        'Cross-Platform': [
          'अपने ऑपरेटिंग सिस्टम के लिए बंडल डाउनलोड करें।',
          'आर्काइव को एक्सट्रैक्ट करें और शामिल README फ़ाइल पढ़ें।',
          'निर्देशों के अनुसार एप्लिकेशन चलाएं।',
        ],
      },
      couponLabel: 'क्या आपके पास कूपन कोड है?',
      couponPlaceholder: 'कूपन कोड दर्ज करें (जैसे LAUNCH25)',
      applyCoupon: 'लागू करें',
      removeCoupon: 'हटाएं',
      couponApplied: 'कूपन सफलतापूर्वक लागू हो गया',
      couponInvalid: 'अमान्य या निष्क्रिय कूपन कोड।',
      couponExpired: 'इस कूपन कोड की समय सीमा समाप्त हो गई है।',
      couponLimitReached: 'इस कूपन के उपयोग की सीमा समाप्त हो चुकी है।',
      couponNotApplicable: 'यह कूपन इस सॉफ़्टवेयर के लिए मान्य नहीं है।',
      originalPrice: 'मूल मूल्य',
      finalPrice: 'अंतिम मूल्य',
      notFoundTitle: 'पैकेज नहीं मिला',
      notFoundSubtitle: 'यह सॉफ़्टवेयर आइटम संग्रहीत या हटाया जा सकता है।',
    },
    admin: {
      title: 'Toolpotro एडमिन कंसोल',
      subtitle: 'सॉफ़्टवेयर रिलीज़, डायनामिक कूपन और डाउनलोड एनालिटिक्स प्रबंधित करें।',
      signInTitle: 'एडमिन साइन इन',
      signInSubtitle: 'Firebase Authentication द्वारा सुरक्षित। केवल सत्यापित एडमिन ही डेटा बदल सकते हैं।',
      signInGoogle: 'Google से जारी रखें',
      orEmail: 'या ईमेल से साइन इन करें',
      emailLabel: 'एडमिन ईमेल',
      passwordLabel: 'पासवर्ड',
      signInEmail: 'साइन इन करें',
      signOut: 'साइन आउट',
      unauthorizedTitle: 'पहुंच प्रतिबंधित',
      unauthorizedSubtitle: 'आपका खाता लॉग इन है, लेकिन Toolpotro के लिए एडमिन अनुमतियाँ नहीं हैं।',
      stats: {
        totalDownloads: 'कुल डाउनलोड',
        activePackages: 'सक्रिय पैकेज',
        activeCoupons: 'सक्रिय कूपन',
        recentEvents: 'लॉग किए गए इवेंट',
      },
      tabs: {
        software: 'सॉफ़्टवेयर और ऐप्स',
        coupons: 'कूपन कोड',
        analytics: 'डाउनलोड एनालिटिक्स',
      },
      seedStarter: 'स्टार्टर कैटलॉग जोड़ें',
      addSoftware: 'सॉफ़्टवेयर जोड़ें',
      editSoftware: 'सॉफ़्टवेयर संपादित करें',
      saveSoftware: 'पैकेज सहेजें',
      cancel: 'रद्द करें',
      archive: 'आर्काइव',
      restore: 'पुनर्स्थापित करें',
      delete: 'हटाएं',
      addCoupon: 'नया कूपन',
      createCoupon: 'कूपन बनाएं',
      scopeAll: 'सभी आइटम',
      scopeSpecific: 'विशिष्ट सॉफ़्टवेयर',
      active: 'सक्रिय',
      archived: 'आर्काइव्ड',
      inactive: 'निष्क्रिय',
    },
    footer: {
      tagline: 'डेस्कटॉप, मोबाइल और ब्राउज़र के लिए स्वच्छ, प्रत्यक्ष सॉफ़्टवेयर वितरण।',
      rights: 'सर्वाधिकार सुरक्षित।',
      directDistribution: 'सत्यापित प्रत्यक्ष वितरण',
    },
  },
};
