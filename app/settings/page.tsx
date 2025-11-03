"use client"

import { PageContainer } from "@/components/page-container"
import { LocationSettings } from "@/components/location-settings"
import { NotificationSettings } from "@/components/notification-settings"
import { DisplaySettings } from "@/components/display-settings"

export default function SettingsPage() {
  return (
    <PageContainer title="Settings" description="Customize location preferences, notifications, and display options">
      <div className="space-y-6">
        <LocationSettings />
        <NotificationSettings />
        <DisplaySettings />
      </div>
    </PageContainer>
  )
}
