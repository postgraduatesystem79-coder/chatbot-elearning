import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivitiesManagement } from '../components/ActivitiesManagement';

export function Dashboard() {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">{t('activities') || 'الأنشطة التعليمية'}</h1>
      </div>

      <ActivitiesManagement />
    </div>
  );
}
