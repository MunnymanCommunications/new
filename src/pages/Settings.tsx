import React from 'react';
import {
  User,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Code,
  ArrowLeft,
  Zap,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChatStore } from '@/stores/chat';

interface SettingsPageProps {
  onBack: () => void;
}

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    credits: '30 credits/month',
    features: ['5 daily credits', 'Basic AI models', 'Community support', '1 project'],
    current: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    credits: '100 credits/month',
    features: [
      '100 monthly credits',
      'Credit rollover (200 max)',
      'All AI models',
      'Priority support',
      'Unlimited projects',
      'GitHub sync',
      'Custom domains',
    ],
    current: true,
    popular: true,
  },
  {
    name: 'Business',
    price: '$50',
    period: '/month',
    credits: '250 credits/month',
    features: [
      '250 monthly credits',
      'Credit rollover (500 max)',
      'All AI models',
      'SSO',
      'Opt-out of training',
      'Priority support',
      'Team collaboration',
      'Design systems',
    ],
    current: false,
  },
];

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { credits } = useChatStore();

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="bg-secondary/30">
            <TabsTrigger value="account" className="gap-1.5">
              <User className="w-3.5 h-3.5" />
              Account
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <CreditCard className="w-3.5 h-3.5" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="preferences" className="gap-1.5">
              <Palette className="w-3.5 h-3.5" />
              Preferences
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-1.5">
              <Code className="w-3.5 h-3.5" />
              AI Settings
            </TabsTrigger>
          </TabsList>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input defaultValue="Demo User" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue="demo@vibecraft.dev" />
                </div>
              </div>
              <Button size="sm">Save Changes</Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security
              </h3>
              <Button variant="outline" size="sm">
                Change Password
              </Button>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Switch />
              </div>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            {/* Credit Usage */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Credit Usage
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-bold">{credits.remaining}</span>
                  <span className="text-muted-foreground text-sm ml-1">
                    / {credits.total} credits
                  </span>
                </div>
                <Badge variant="secondary">{credits.plan} plan</Badge>
              </div>
              <Progress value={(credits.remaining / credits.total) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Resets on {credits.resetDate.toLocaleDateString()}
              </p>
            </div>

            {/* Plans */}
            <div className="space-y-4">
              <h3 className="font-semibold">Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((plan) => (
                  <div
                    key={plan.name}
                    className={`rounded-xl border p-6 space-y-4 relative ${
                      plan.current
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card'
                    }`}
                  >
                    {plan.popular && (
                      <Badge className="absolute -top-2.5 right-4">Popular</Badge>
                    )}
                    <div>
                      <h4 className="font-semibold text-lg">{plan.name}</h4>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold">{plan.price}</span>
                        <span className="text-muted-foreground text-sm">{plan.period}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{plan.credits}</p>
                    </div>
                    <Separator />
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={plan.current ? 'outline' : 'default'}
                      className="w-full"
                      size="sm"
                    >
                      {plan.current ? 'Current Plan' : 'Upgrade'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <h3 className="font-semibold">Appearance</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Use dark theme</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Compact Mode</p>
                    <p className="text-xs text-muted-foreground">Reduce spacing in UI</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Deployment notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified when deployments complete
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Credit warnings</p>
                    <p className="text-xs text-muted-foreground">
                      Alert when credits are running low
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">AI Model</h3>
              <p className="text-sm text-muted-foreground">
                Choose the AI model used for code generation
              </p>
              <div className="space-y-3">
                {[
                  {
                    name: 'Claude Sonnet 4.5',
                    desc: 'Fast, balanced performance',
                    badge: 'Recommended',
                  },
                  {
                    name: 'Claude Opus 4.5',
                    desc: 'Most capable, complex tasks',
                    badge: 'Pro',
                  },
                ].map((model) => (
                  <label
                    key={model.name}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="model"
                        className="accent-primary"
                        defaultChecked={model.badge === 'Recommended'}
                      />
                      <div>
                        <p className="text-sm font-medium">{model.name}</p>
                        <p className="text-xs text-muted-foreground">{model.desc}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {model.badge}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">API Key</h3>
              <p className="text-sm text-muted-foreground">
                Optionally use your own Anthropic API key for unlimited usage
              </p>
              <Input type="password" placeholder="sk-ant-..." />
              <Button size="sm" variant="outline">
                Save Key
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
