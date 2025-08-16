'use client';

import { useState } from 'react';
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
import { useDevMode } from '@/providers/dev-mode-provider';
import {
  Settings,
  Zap,
  Shield,
  Bell,
  Save,
  RefreshCw,
  AlertTriangle,
  User,
  Lock,
  Palette,
} from 'lucide-react';

// Simple label component
const Label = ({ htmlFor, children, ...props }: any) => (
  <label
    htmlFor={htmlFor}
    className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
    {...props}
  >
    {children}
  </label>
);

// Simple switch component
const Switch = ({ checked, onCheckedChange, ...props }: any) => (
  <button
    type='button'
    role='switch'
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={`peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-primary' : 'bg-input'
    }`}
    {...props}
  >
    <span
      className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

export default function SettingsPage() {
  const { user, getCurrentRole } = useAuth();
  const { isDevMode } = useDevMode();
  const [activeTab, setActiveTab] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);

  // Mock settings state
  const [settings, setSettings] = useState({
    applicationName: 'Taskorly RAG Chat',
    description: 'AI-powered document chat and retrieval system',
    llmModel: 'gpt-4-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    systemPrompt:
      'You are a helpful AI assistant that provides accurate information based on the provided documents.',
    authRequired: true,
    sessionTimeout: 24,
    encryptionEnabled: true,
    emailNotifications: true,
    systemAlerts: true,
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSaveSettings = () => {
    console.log('Saving settings:', settings);
    setHasChanges(false);
  };

  const handleResetSettings = () => {
    setHasChanges(false);
  };

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'ai', label: 'AI Models', icon: Zap },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

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
            disabled={!hasChanges}
          >
            <RefreshCw className='mr-2 h-4 w-4' />
            Reset
          </Button>
          <Button size='sm' onClick={handleSaveSettings} disabled={!hasChanges}>
            <Save className='mr-2 h-4 w-4' />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Simple tab navigation */}
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
              <Settings className='mr-2 h-5 w-5' />
              General Settings
            </CardTitle>
            <CardDescription>
              Basic application configuration and preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='appName'>Application Name</Label>
                <Input
                  id='appName'
                  value={settings.applicationName}
                  onChange={e =>
                    handleSettingChange('applicationName', e.target.value)
                  }
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={settings.description}
                onChange={e =>
                  handleSettingChange('description', e.target.value)
                }
                rows={3}
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
            <div className='grid gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='llmModel'>LLM Model</Label>
                <Input
                  id='llmModel'
                  value={settings.llmModel}
                  onChange={e =>
                    handleSettingChange('llmModel', e.target.value)
                  }
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='maxTokens'>Max Tokens</Label>
                <Input
                  id='maxTokens'
                  type='number'
                  value={settings.maxTokens}
                  onChange={e =>
                    handleSettingChange('maxTokens', parseInt(e.target.value))
                  }
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='temperature'>Temperature</Label>
              <Input
                id='temperature'
                type='number'
                min='0'
                max='2'
                step='0.1'
                value={settings.temperature}
                onChange={e =>
                  handleSettingChange('temperature', parseFloat(e.target.value))
                }
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='systemPrompt'>System Prompt</Label>
              <Textarea
                id='systemPrompt'
                value={settings.systemPrompt}
                onChange={e =>
                  handleSettingChange('systemPrompt', e.target.value)
                }
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Shield className='mr-2 h-5 w-5' />
              Security Settings
            </CardTitle>
            <CardDescription>
              Configure security and authentication settings.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <Label htmlFor='authRequired'>Authentication Required</Label>
                  <p className='text-xs text-muted-foreground'>
                    Require users to authenticate
                  </p>
                </div>
                <Switch
                  id='authRequired'
                  checked={settings.authRequired}
                  onCheckedChange={(checked: boolean) =>
                    handleSettingChange('authRequired', checked)
                  }
                />
              </div>

              <div className='flex items-center justify-between'>
                <div>
                  <Label htmlFor='encryptionEnabled'>Data Encryption</Label>
                  <p className='text-xs text-muted-foreground'>
                    Enable data encryption at rest
                  </p>
                </div>
                <Switch
                  id='encryptionEnabled'
                  checked={settings.encryptionEnabled}
                  onCheckedChange={(checked: boolean) =>
                    handleSettingChange('encryptionEnabled', checked)
                  }
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='sessionTimeout'>Session Timeout (hours)</Label>
              <Input
                id='sessionTimeout'
                type='number'
                min='1'
                max='168'
                value={settings.sessionTimeout}
                onChange={e =>
                  handleSettingChange(
                    'sessionTimeout',
                    parseInt(e.target.value)
                  )
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center'>
              <Bell className='mr-2 h-5 w-5' />
              Notification Settings
            </CardTitle>
            <CardDescription>
              Configure notification preferences and alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <Label htmlFor='emailNotifications'>
                    Email Notifications
                  </Label>
                  <p className='text-xs text-muted-foreground'>
                    Send notifications via email
                  </p>
                </div>
                <Switch
                  id='emailNotifications'
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked: boolean) =>
                    handleSettingChange('emailNotifications', checked)
                  }
                />
              </div>

              <div className='flex items-center justify-between'>
                <div>
                  <Label htmlFor='systemAlerts'>System Alerts</Label>
                  <p className='text-xs text-muted-foreground'>
                    Show system status alerts
                  </p>
                </div>
                <Switch
                  id='systemAlerts'
                  checked={settings.systemAlerts}
                  onCheckedChange={(checked: boolean) =>
                    handleSettingChange('systemAlerts', checked)
                  }
                />
              </div>
            </div>
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
