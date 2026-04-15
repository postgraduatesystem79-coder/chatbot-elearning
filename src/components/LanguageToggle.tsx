import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { cn } from '../lib/utils';

export function LanguageToggle() {
  const { i18n, t } = useTranslation();

  const toggle = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-md transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "text-muted-foreground text-sm font-medium"
      )}
    >
      <Languages size={18} />
      <span>{i18n.language === 'ar' ? 'English' : 'العربية'}</span>
    </button>
  );
}
