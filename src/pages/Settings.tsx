import React, { useEffect, useState } from 'react';
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
  Key,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/auth';
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  listModels,
  type SavedKey,
  type AIModel,
} from '@/lib/api-keys';

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
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/month',
    credits: '100 credits/month',
    features: ['100 monthly credits', 'Credit rollover (200 max)', 'All AI models', 'Priority support', 'Unlimited projects', 'GitHub sync', 'Custom domains'],
    popular: true,
  },
  {
    name: 'Business',
    price: '$50',
    period: '/month',
    credits: '250 credits/month',
    features: ['250 monthly credits', 'Credit rollover (500 max)', 'All AI models', 'SSO', 'Opt-out of training', 'Priority support', 'Team collaboration'],
  },
];

const PROVIDER_INFO: Record<string, { name: string; placeholder: string; docsUrl: string }> = {
  anthropic: { name: 'Anthropic', placeholder: 'sk-ant-api03-...', docsUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { name: 'OpenAI', placeholder: 'sk-proj-...', docsUrl: 'https://platform.openai.com/api-keys' },
  google: { name: 'Google AI', placeholder: 'AIza...', docsUrl: 'https://aistudio.google.com/apikey' },
};

export function SettingsPage({ onBack }: SettingsPageProps) {
  const { profile, user } = useAuthStore();

  const creditsRemaining = profile?.credits_remaining ?? 0;
  const creditsTotal = profile?.credits_total ?? 100;
  const plan = profile?.plan ?? 'free';

  const [models, setModels] = useState<AIModel[]>([]);
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([]);
  const [selectedModel, setSelectedModel] = useState(profile?.preferred_model || 'claude-sonnet-4-5-20250929');
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  useEffect(() => {
    listModels().then(setModels);
    listApiKeys().then(setSavedKeys);
  }, []);

  useEffect(() => {
    (window as any).__vibecraft_preferred_model = selectedModel;
  }, [selectedModel]);

  const handleSaveKey = async (provider: string) => {
    const key = keyInputs[provider];
    if (!key) return;

    setSavingKey(provider);
    setKeyError(null);
    setKeySuccess(null);

    const result = await saveApiKey(provider, key);
    setSavingKey(null);

    if (result.success) {
      setKeySuccess(`${PROVIDER_INFO[provider].name} key saved (${result.hint})`);
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
      const keys = await listApiKeys();
      setSavedKeys(keys);
    } else {
      setKeyError(result.error || 'Failed to save key');
    }
  };

  const handleDeleteKey = async (provider: string) => {
    await deleteApiKey(provider);
    const keys = await listApiKeys();
    setSavedKeys(keys);
  };

  const getSavedKey = (provider: string) => savedKeys.find((k) => k.provider === provider);

  const groupedModels = {
    anthropic: models.filter((m) => m.provider === 'anthropic'),
    openai: models.filter((m) => m.provider === 'openai'),
    google: models.filter((m) => m.provider === 'google'),
  };

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

        <Tabs defaultValue="ai" className="space-y-6">
          <TabsList className="bg-secondary/30">
            <TabsTrigger value="ai" className="gap-1.5">
              <Code className="w-3.5 h-3.5" />
              AI & Models
            </TabsTrigger>
            <TabsTrigger value="keys" className="gap-1.5">
              <Key className="w-3.5 h-3.5" />
              API Keys
            </TabsTrigger>
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
          </TabsList>

          {/* AI Models Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Select AI Model</h3>
              <p className="text-sm text-muted-foreground">
                Choose the AI model for code generation. Models marked with a key icon require your own API key.
              </p>

              {Object.entries(groupedModels).map(([provider, providerModels]) => (
                providerModels.length > 0 && (
                  <div key={provider} className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {PROVIDER_INFO[provider]?.name || provider}
                    </h4>
                    <div className="space-y-2">
                      {providerModels.map((model) => {
                        const hasKey = model.platformKeyAvailable || !!getSavedKey(model.provider);
                        return (
                          <label
                            key={model.id}
                            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                              selectedModel === model.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            } ${!hasKey ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="model"
                                className="accent-primary"
                                checked={selectedModel === model.id}
                                onChange={() => setSelectedModel(model.id)}
                                disabled={!hasKey}
                              />
                              <div>
                                <p className="text-sm font-medium">{model.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {model.maxTokens.toLocaleString()} max tokens
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!hasKey && (
                                <Badge variant="outline" className="text-xs text-orange-500 border-orange-500/30">
                                  <Key className="w-3 h-3 mr-1" />
                                  Key needed
                                </Badge>
                              )}
                              {hasKey && (
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                              )}
                              <Badge variant="outline" className="text-xs">
                                {model.tier}
                              </Badge>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              ))}
            </div>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="keys" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Keys
              </h3>
              <p className="text-sm text-muted-foreground">
                Add your own API keys to use models from different providers. Keys are encrypted and stored securely.
                Platform-provided keys (if available) are used as fallback.
              </p>

              {keyError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {keyError}
                </div>
              )}
              {keySuccess && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-500">
                  {keySuccess}
                </div>
              )}

              {(['anthropic', 'openai', 'google'] as const).map((provider) => {
                const info = PROVIDER_INFO[provider];
                const saved = getSavedKey(provider);

                return (
                  <div key={provider} className="space-y-3 p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">{info.name}</h4>
                        {saved ? (
                          <p className="text-xs text-green-500">
                            Saved: {saved.key_hint}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not configured</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href={info.docsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Get key <ExternalLink className="w-3 h-3" />
                        </a>
                        {saved && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDeleteKey(provider)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        placeholder={info.placeholder}
                        value={keyInputs[provider] || ''}
                        onChange={(e) => setKeyInputs((prev) => ({ ...prev, [provider]: e.target.value }))}
                        className="font-mono text-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleSaveKey(provider)}
                        disabled={!keyInputs[provider] || savingKey === provider}
                      >
                        {savingKey === provider ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold">Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input defaultValue={profile?.name || ''} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue={user?.email || ''} disabled />
                </div>
              </div>
              <Button size="sm">Save Changes</Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Security
              </h3>
              <Button variant="outline" size="sm">Change Password</Button>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Switch />
              </div>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Credit Usage
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-3xl font-bold">{creditsRemaining}</span>
                  <span className="text-muted-foreground text-sm ml-1">/ {creditsTotal} credits</span>
                </div>
                <Badge variant="secondary">{plan} plan</Badge>
              </div>
              <Progress value={creditsTotal > 0 ? (creditsRemaining / creditsTotal) * 100 : 0} className="h-2" />
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map((planItem) => (
                  <div
                    key={planItem.name}
                    className={`rounded-xl border p-6 space-y-4 relative ${
                      planItem.name.toLowerCase() === plan ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    {planItem.popular && <Badge className="absolute -top-2.5 right-4">Popular</Badge>}
                    <div>
                      <h4 className="font-semibold text-lg">{planItem.name}</h4>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-bold">{planItem.price}</span>
                        <span className="text-muted-foreground text-sm">{planItem.period}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{planItem.credits}</p>
                    </div>
                    <Separator />
                    <ul className="space-y-2">
                      {planItem.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={planItem.name.toLowerCase() === plan ? 'outline' : 'default'}
                      className="w-full"
                      size="sm"
                    >
                      {planItem.name.toLowerCase() === plan ? 'Current Plan' : 'Upgrade'}
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
                    <p className="text-xs text-muted-foreground">Get notified when deployments complete</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Credit warnings</p>
                    <p className="text-xs text-muted-foreground">Alert when credits are running low</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
