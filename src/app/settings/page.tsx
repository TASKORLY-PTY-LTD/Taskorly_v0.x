'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/providers/auth-provider';
import {
  Settings as LucideSettings,
  Zap,
  Save,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/utils/trpc';

const Label = ({ htmlFor, children, ...props }: any) => (
  <label
    htmlFor={htmlFor}
    className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
    {...props}
  >
    {children}
  </label>
);

export default function SettingsPage() {
  const { user, getCurrentRole } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // Use QUERY instead of mutation for fetching
  const { data, isLoading, error, refetch } = trpc.settings.fetch.useQuery(
    undefined,
    {
      enabled: !!user, // Only run query when user exists
    }
  );

  const saveSettings = trpc.settings.save.useMutation({
    onSuccess: () => {
      setHasChanges(false);
      refetch(); // Refresh data after save
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
    }
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (data) {
      setSettings(data);
    }
  }, [data]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>User not found</CardTitle>
            <CardDescription>
              Please log in to access settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSettingChange = (key: string, value: any) => {
    setSettings((prev: any) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    if (!user || !settings) return;
    
    await saveSettings.mutateAsync({
      Description: settings.Description,
      Industry: settings.Industry,
    });
  };

  const handleResetSettings = async () => {
    if (!user) return;
    await refetch();
    setHasChanges(false);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: LucideSettings },
    { id: 'ai', label: 'AI Models', icon: Zap },
  ];

  if (!settings) return null;

  return (
    <div className='flex-1 space-y-4 p-4 md:p-6 pt-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Settings</h1>
          <p className='text-muted-foreground'>
            Configure your application settings and preferences.
          </p>
        </div>
        <div className='flex items-center space-x-2'>
          {hasChanges && (
            <Badge variant='secondary' className='text-xs'>
              Unsaved changes
            </Badge>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={handleResetSettings}
            disabled={!hasChanges || saveSettings.isPending}
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Reset
          </Button>
          <Button 
            size='sm' 
            onClick={handleSaveSettings} 
            disabled={!hasChanges || saveSettings.isPending}
          >
            <Save className='mr-2 h-4 w-4' />
            {saveSettings.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className='border-b'>
        <nav className='-mb-px flex space-x-8'>
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className='mr-2 h-4 w-4' />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <LucideSettings className='mr-2 h-5 w-5' />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic application configuration and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='Industry'>Business Industry</Label>
                <Input
                  id='Industry'
                  value={settings.Industry || ''}
                  onChange={e =>
                    handleSettingChange('Industry', e.target.value)
                  }
                  placeholder="e.g., Technology, Healthcare, Finance"
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='Description'>Business Description</Label>
              <Textarea
                id='Description'
                value={settings.Description || ''}
                onChange={e =>
                  handleSettingChange('Description', e.target.value)
                }
                rows={3}
                placeholder="Describe your business or use case..."
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'ai' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Zap className='mr-2 h-5 w-5' />
              AI Model Configuration
            </CardTitle>
            <CardDescription>
              Configure AI models for language processing.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-muted-foreground'>
              AI model configuration coming soon...
            </p>
          </CardContent>
        </Card>
      )}

      {getCurrentRole() !== 'user' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center text-yellow-600'>
              <AlertTriangle className='mr-2 h-5 w-5' />
              Admin Notice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm text-muted-foreground'>
              You are currently logged in as <strong>{getCurrentRole()}</strong>
              . Changes to these settings will affect all users of the system.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}