"use client"

import { PageContainer } from "@/components/page-container"
import { LocationSettings } from "@/components/location-settings"
import { DisplaySettings } from "@/components/display-settings"

export default function SettingsPage() {
  return (
    <PageContainer title="Settings" description="Location preferences and display options">
      <div className="space-y-6">
        <LocationSettings />
        <DisplaySettings />
      </div>
    </PageContainer>
  )
}
