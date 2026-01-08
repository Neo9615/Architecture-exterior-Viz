
import React from 'react';
import { User, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { translations, Language } from '../translations';

export const Verification: React.FC<{ user: User, lang: Language }> = ({ user, lang }) => {
  const t = translations[lang];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-xl text-center">
          <div className="w-16 h-16 bg-gray-100 text-gray-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-200">
            <i className="fas fa-envelope-open-text text-2xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.verifyEmail}</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {t.verifySent.replace('{email}', user.email || '')}
          </p>

          <div className="flex flex-col gap-3">
             <button onClick={() => window.location.reload()} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2">
               <i className="fas fa-sync-alt"></i> {t.verifiedButton}
             </button>
             <button onClick={() => sendEmailVerification(user)} className="w-full bg-white text-gray-600 font-medium py-3 rounded-xl border border-gray-200">
               {t.resendEmail}
             </button>
             <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-gray-900 text-xs mt-4">
               {t.signOut}
             </button>
          </div>
        </div>
      </div>
  );
};
