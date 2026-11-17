import { useEffect, useState } from 'react';
import { CreditCard, Building2, Bell, Lock, Layers, UserRound, FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { InlineAlert } from '@/components/ui/Feedback';
import { Checkbox, Field, Input, Select, Toggle } from '@/components/ui/Input';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { useSession } from '@/lib/session';
import { api } from '@/lib/api';
import type { FrameworkKey, Organization, Workspace } from '@/lib/types';

const ALLOWED_UPLOAD_TYPES = ['pdf', 'docx', 'txt', 'csv'] as const;

export function SettingsPage() {
  const toast = useToast();
  const { context, refresh } = useSession();
  const [active, setActive] = useState('profile');

  const organization = context?.organization ?? null;
  const workspace = context?.workspace ?? null;
  const user = context?.user ?? null;
  const canEditOrganization = user?.role === 'owner' || user?.role === 'admin';
  const trialEnd = organization?.trialEndsAt ? new Date(organization.trialEndsAt) : null;
  const trialDaysRemaining = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000)) : null;

  const [organizationForm, setOrganizationForm] = useState({
    name: '',
    industry: '',
    employeeCount: 0,
    primaryFramework: 'soc2' as FrameworkKey,
  });
  const [workspaceName, setWorkspaceName] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    defaultFramework: 'soc2' as FrameworkKey,
    monthlyDigest: false,
    gapAlerts: false,
    reportReadyEmails: false,
    uploadNotifications: false,
    mfaRequired: false,
    sessionTimeoutMinutes: 30,
    retentionDays: 365,
    allowedUploadTypes: [...ALLOWED_UPLOAD_TYPES] as string[],
  });
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!organization) return;
    setOrganizationForm({
      name: organization.name,
      industry: organization.industry,
      employeeCount: organization.employeeCount,
      primaryFramework: organization.primaryFramework,
    });
    setSettingsForm({
      defaultFramework: organization.settings.defaultFramework,
      monthlyDigest: organization.settings.monthlyDigest,
      gapAlerts: organization.settings.gapAlerts,
      reportReadyEmails: organization.settings.reportReadyEmails,
      uploadNotifications: organization.settings.uploadNotifications,
      mfaRequired: organization.settings.mfaRequired,
      sessionTimeoutMinutes: organization.settings.sessionTimeoutMinutes,
      retentionDays: organization.settings.retentionDays,
      allowedUploadTypes: organization.settings.allowedUploadTypes,
    });
  }, [organization]);

  useEffect(() => {
    if (workspace) setWorkspaceName(workspace.name);
  }, [workspace]);

  const saveOrganization = async (section: string, patch: Record<string, unknown>) => {
    setSaving(section);
    try {
      await api.patch<{ organization: Organization }>('/api/organization', patch);
      await refresh();
      toast.success('Settings saved', 'Your workspace configuration is up to date.');
    } catch (error) {
      toast.error('Could not save settings', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const saveWorkspace = async () => {
    setSaving('workspace');
    try {
      await api.patch<{ workspace: Workspace }>('/api/workspace', { name: workspaceName });
      await refresh();
      toast.success('Workspace renamed', `This workspace is now called ${workspaceName}.`);
    } catch (error) {
      toast.error('Could not rename the workspace', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const readOnlyNotice = (
    <InlineAlert tone="info" title="Your organisation workspace">
      Your evidence, findings and reports are scoped to your organisation. Settings saved here apply to your workspace.
    </InlineAlert>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Profile, organisation, workspace, framework preferences, security and notification defaults."
      />

      <Tabs
        ariaLabel="Settings sections"
        active={active}
        onChange={setActive}
        items={[
          { id: 'profile', label: 'Profile', icon: <UserRound className="size-3.5" aria-hidden="true" /> },
          { id: 'organization', label: 'Organization', icon: <Building2 className="size-3.5" aria-hidden="true" /> },
          { id: 'workspace', label: 'Workspace', icon: <FolderKanban className="size-3.5" aria-hidden="true" /> },
          { id: 'frameworks', label: 'Frameworks', icon: <Layers className="size-3.5" aria-hidden="true" /> },
          { id: 'notifications', label: 'Notifications', icon: <Bell className="size-3.5" aria-hidden="true" /> },
          { id: 'security', label: 'Security', icon: <Lock className="size-3.5" aria-hidden="true" /> },
          { id: 'billing', label: 'Billing', icon: <CreditCard className="size-3.5" aria-hidden="true" /> },
        ]}
      />

      <TabPanel id="profile" active={active} className="space-y-5">
        <Card>
          <CardHeader
            title="Profile"
            description="The signed-in identity for this workspace"
            actions={user?.isDemoUser ? <Badge tone="info" size="sm">Demo persona</Badge> : null}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="profile-name">
              <Input id="profile-name" value={user?.name ?? ''} readOnly disabled />
            </Field>
            <Field label="Email" htmlFor="profile-email">
              <Input id="profile-email" value={user?.email ?? ''} readOnly disabled />
            </Field>
            <Field label="Job title" htmlFor="profile-title">
              <Input id="profile-title" value={user?.jobTitle ?? ''} readOnly disabled />
            </Field>
            <Field label="Role" htmlFor="profile-role">
              <Input id="profile-role" value={user?.role ?? ''} readOnly disabled />
            </Field>
            <div className="sm:col-span-2">
              <InlineAlert tone="neutral" title="Profile editing">
                Profile editing and self-service password changes are not available in this release. Use the account email you registered with when contacting support.
              </InlineAlert>
            </div>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="organization" active={active} className="space-y-5">
        {readOnlyNotice}
        <Card>
          <CardHeader
            title="Organization"
            description="Shown on generated reports and used to scope evidence"
            actions={<Badge tone="outline" size="sm">{organization?.plan ?? 'starter'} plan</Badge>}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Organization name" htmlFor="org-name" hint="Printed on the report cover page.">
              <Input
                id="org-name"
                value={organizationForm.name}
                onChange={(event) => setOrganizationForm({ ...organizationForm, name: event.target.value })}
                disabled={!canEditOrganization}
              />
            </Field>
            <Field label="Industry" htmlFor="org-industry">
              <Input
                id="org-industry"
                value={organizationForm.industry}
                onChange={(event) => setOrganizationForm({ ...organizationForm, industry: event.target.value })}
                disabled={!canEditOrganization}
              />
            </Field>
            <Field label="Employee count" htmlFor="org-employees" hint="Used for scoping guidance only.">
              <Input
                id="org-employees"
                type="number"
                min={0}
                max={100000}
                value={organizationForm.employeeCount}
                onChange={(event) => setOrganizationForm({ ...organizationForm, employeeCount: Number(event.target.value) })}
                disabled={!canEditOrganization}
              />
            </Field>
            <Field label="Primary framework" htmlFor="org-framework">
              <Select
                id="org-framework"
                value={organizationForm.primaryFramework}
                onChange={(event) =>
                  setOrganizationForm({ ...organizationForm, primaryFramework: event.target.value as FrameworkKey })
                }
                disabled={!canEditOrganization}
              >
                <option value="soc2">SOC 2 — Trust Services Criteria</option>
                <option value="iso27001">ISO/IEC 27001 — Annex A</option>
              </Select>
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Button
                variant="primary"
                loading={saving === 'organization'}
                disabled={!canEditOrganization}
                onClick={() =>
                  saveOrganization('organization', {
                    name: organizationForm.name,
                    industry: organizationForm.industry,
                    employeeCount: organizationForm.employeeCount,
                    primaryFramework: organizationForm.primaryFramework,
                  })
                }
              >
                Save organization
              </Button>
              {!canEditOrganization ? (
                <p className="text-[12.5px] text-ink-500">Only workspace owners and admins can change these settings.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="workspace" active={active} className="space-y-5">
        <Card>
          <CardHeader title="Workspace" description="Workspaces separate evidence, findings and reports" />
          <CardContent className="space-y-4">
            <Field label="Workspace name" htmlFor="workspace-name" hint="Give this workspace a name your team will recognise.">
              <Input
                id="workspace-name"
                value={workspaceName}
                maxLength={80}
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
            </Field>
            <dl className="grid gap-3 text-[12.5px] sm:grid-cols-3">
              <div className="rounded-lg border border-ink-200 px-3.5 py-3">
                <dt className="text-ink-500">Workspace ID</dt>
                <dd className="mt-0.5 font-mono text-[12px] text-ink-800">{workspace?.id ?? '—'}</dd>
              </div>
              <div className="rounded-lg border border-ink-200 px-3.5 py-3">
                <dt className="text-ink-500">Created</dt>
                <dd className="mt-0.5 text-ink-800">{workspace?.createdAt ? new Date(workspace.createdAt).toLocaleDateString() : '—'}</dd>
              </div>
              <div className="rounded-lg border border-ink-200 px-3.5 py-3">
                <dt className="text-ink-500">Type</dt>
                <dd className="mt-0.5 text-ink-800">{workspace?.isDemo ? 'Organisation workspace' : 'Customer workspace'}</dd>
              </div>
            </dl>
            <Button
              variant="primary"
              loading={saving === 'workspace'}
              disabled={!workspaceName.trim() || workspaceName === workspace?.name}
              onClick={saveWorkspace}
            >
              Save workspace
            </Button>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="frameworks" active={active} className="space-y-5">
        <Card>
          <CardHeader title="Framework preferences" description="Defaults for dashboards, control lists and new reports" />
          <CardContent className="space-y-4">
            <Field label="Default framework" htmlFor="default-framework" hint="The dashboard and readiness views open on this framework.">
              <Select
                id="default-framework"
                value={settingsForm.defaultFramework}
                onChange={(event) => setSettingsForm({ ...settingsForm, defaultFramework: event.target.value as FrameworkKey })}
                disabled={!canEditOrganization}
              >
                <option value="soc2">SOC 2 — Trust Services Criteria (28 controls)</option>
                <option value="iso27001">ISO/IEC 27001 — Annex A (22 controls)</option>
              </Select>
            </Field>
            <ButtonLink to="/app/frameworks" variant="secondary">
              View framework readiness
            </ButtonLink>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                loading={saving === 'frameworks'}
                disabled={!canEditOrganization}
                onClick={() => saveOrganization('frameworks', { settings: { defaultFramework: settingsForm.defaultFramework } })}
              >
                Save preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="notifications" active={active} className="space-y-5">
        <Card>
          <CardHeader
            title="Notifications"
            description="Email delivery is not enabled yet. You can save preferences for when notifications become available."
          />
          <CardContent className="divide-y divide-ink-100">
            <Toggle
              label="Monthly readiness digest"
              description="A monthly summary of readiness score, new findings and resolved gaps."
              checked={settingsForm.monthlyDigest}
              onChange={(checked) => setSettingsForm({ ...settingsForm, monthlyDigest: checked })}
            />
            <Toggle
              label="New gap alerts"
              description="Notify the suggested owner when a control moves to missing or needs attention."
              checked={settingsForm.gapAlerts}
              onChange={(checked) => setSettingsForm({ ...settingsForm, gapAlerts: checked })}
            />
            <Toggle
              label="Report ready"
              description="Email the requested person when a generated report finishes rendering."
              checked={settingsForm.reportReadyEmails}
              onChange={(checked) => setSettingsForm({ ...settingsForm, reportReadyEmails: checked })}
            />
            <Toggle
              label="Upload notifications"
              description="Notify the workspace when a teammate uploads evidence."
              checked={settingsForm.uploadNotifications}
              onChange={(checked) => setSettingsForm({ ...settingsForm, uploadNotifications: checked })}
            />
          </CardContent>
          <CardContent className="border-t border-ink-200">
            <Button
              variant="primary"
              loading={saving === 'notifications'}
              disabled={!canEditOrganization}
              onClick={() =>
                saveOrganization('notifications', {
                  settings: {
                    monthlyDigest: settingsForm.monthlyDigest,
                    gapAlerts: settingsForm.gapAlerts,
                    reportReadyEmails: settingsForm.reportReadyEmails,
                    uploadNotifications: settingsForm.uploadNotifications,
                  },
                })
              }
            >
              Save notification preferences
            </Button>
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="security" active={active} className="space-y-5">
        <Card>
          <CardHeader title="Security" description="Workspace-level controls for sessions and evidence handling" />
          <CardContent className="divide-y divide-ink-100">
            <Toggle
              label="Require multi-factor authentication"
              description="Multi-factor authentication enforcement is not available in this release."
              checked={settingsForm.mfaRequired}
              onChange={(checked) => setSettingsForm({ ...settingsForm, mfaRequired: checked })}
            />
          </CardContent>
          <CardContent className="grid gap-4 border-t border-ink-200 sm:grid-cols-2">
            <Field label="Session timeout (minutes)" htmlFor="session-timeout" hint="Between 5 and 480 minutes.">
              <Input
                id="session-timeout"
                type="number"
                min={5}
                max={480}
                value={settingsForm.sessionTimeoutMinutes}
                onChange={(event) => setSettingsForm({ ...settingsForm, sessionTimeoutMinutes: Number(event.target.value) })}
              />
            </Field>
            <Field label="Evidence retention (days)" htmlFor="retention-days" hint="Between 30 and 2555 days.">
              <Input
                id="retention-days"
                type="number"
                min={30}
                max={2555}
                value={settingsForm.retentionDays}
                onChange={(event) => setSettingsForm({ ...settingsForm, retentionDays: Number(event.target.value) })}
              />
            </Field>
            <div className="sm:col-span-2">
              <p className="text-[13px] font-medium text-ink-700">Accepted upload types</p>
              <p className="mt-0.5 text-[12px] text-ink-500">
                Server-side validation always applies these extensions, whatever is selected here.
              </p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {ALLOWED_UPLOAD_TYPES.map((extension) => (
                  <Checkbox
                    key={extension}
                    label={`.${extension}`}
                    checked={settingsForm.allowedUploadTypes.includes(extension)}
                    onChange={(checked) =>
                      setSettingsForm({
                        ...settingsForm,
                        allowedUploadTypes: checked
                          ? [...settingsForm.allowedUploadTypes, extension]
                          : settingsForm.allowedUploadTypes.filter((item) => item !== extension),
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </CardContent>
          <CardContent className="border-t border-ink-200">
            <Button
              variant="primary"
              loading={saving === 'security'}
              disabled={!canEditOrganization}
              onClick={() =>
                saveOrganization('security', {
                  settings: {
                    mfaRequired: settingsForm.mfaRequired,
                    sessionTimeoutMinutes: settingsForm.sessionTimeoutMinutes,
                    retentionDays: settingsForm.retentionDays,
                    allowedUploadTypes: settingsForm.allowedUploadTypes,
                  },
                })
              }
            >
              Save security settings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Implemented security safeguards" description="Current application safeguards; these do not represent a security certification." />
          <CardContent className="grid gap-2 text-[12.5px] text-ink-600 sm:grid-cols-2">
            {[
              'Passwords are hashed with scrypt; tokens are short-lived HS256 JWTs.',
              'Every evidence, control, gap and report request is scoped to your organisation.',
              'Uploads are validated for extension and size before storage.',
              'Request bodies are validated server-side; errors never leak stack traces.',
              'Secrets live in environment variables — never in the frontend bundle.',
              'PDF reports are rendered server-side and streamed to the requester.',
            ].map((item) => (
              <p key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
                {item}
              </p>
            ))}
          </CardContent>
        </Card>
      </TabPanel>

      <TabPanel id="billing" active={active} className="space-y-5">
        <InlineAlert tone="info" title="No payment card required">
          Your 14-day trial starts when your organisation account is created. Paid checkout is not enabled yet; payment details will be collected only when paid plans are launched.
        </InlineAlert>
        <Card>
          <CardHeader
            title="Trial status"
            description="Your organisation's current access period"
            actions={<Badge tone={trialDaysRemaining === null ? 'outline' : trialDaysRemaining > 0 ? 'info' : 'danger'} size="sm">
              {trialDaysRemaining === null ? 'Date unavailable' : trialDaysRemaining > 0 ? `${trialDaysRemaining} days remaining` : 'Trial ended'}
            </Badge>}
          />
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-ink-200 px-3.5 py-3">
              <p className="text-[12px] text-ink-500">Trial started</p>
              <p className="mt-1 text-[14px] font-medium text-ink-900">
                {organization?.trialStartedAt ? new Date(organization.trialStartedAt).toLocaleDateString() : 'Not available'}
              </p>
            </div>
            <div className="rounded-lg border border-ink-200 px-3.5 py-3">
              <p className="text-[12px] text-ink-500">Trial ends</p>
              <p className="mt-1 text-[14px] font-medium text-ink-900">
                {trialEnd ? trialEnd.toLocaleDateString() : 'Not available'}
              </p>
            </div>
          </CardContent>
          <CardContent className="border-t border-ink-200">
            <p className="text-[13px] leading-relaxed text-ink-600">
              {trialDaysRemaining === null
                ? 'Trial dates are not available for this account. Contact support for assistance.'
                : trialDaysRemaining > 0
                  ? 'You can use your private workspace during the trial. No payment method is collected.'
                  : 'Your trial period has ended. Contact the ComplyLens team to discuss continued access.'}
            </p>
          </CardContent>
        </Card>
      </TabPanel>
    </div>
  );
}
