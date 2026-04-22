"use client"

import * as React from "react"
import Link from "next/link"
import {
  BookOpen,
  LayoutDashboard,
  ChartArea,
  Bell,
  Shield,
  type LucideIcon,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { DeviceSelector } from "@/components/device-selector"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/context/AuthContext"
// import { useAlerts } from "@/hooks/useAlerts"
import Image from "next/image"

type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  isActive?: boolean
  badge?: number | string
  items?: {
    title: string
    url: string
  }[]
}

const baseNavMain: NavItem[] = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Analytics",
    url: "/dashboard/analytics",
    icon: ChartArea,
  },
  {
    title: "Notifications",
    url: "/dashboard/notifications",
    icon: Bell,
  },
];



export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user, loading } = useAuth();
  // const { criticalCount } = useAlerts();

  // Check if user authenticated with email/password
  const isEmailPasswordUser = user?.providerData?.some(
    provider => provider.providerId === "password"
  ) ?? false;

  const navMain = React.useMemo(() => {
    const items = baseNavMain.map(item => {
      // if (item.title === "Notifications") {
      //   return {
      //     ...item,
      //     badge: criticalCount > 0 ? criticalCount : undefined
      //   };
      // }
      return item;
    });

    // Add Admin link for email/password users
    if (isEmailPasswordUser) {
      items.unshift({
        title: "Admin",
        url: "/dashboard/admin",
        icon: Shield,
        isActive: false,
        items: [
          {
            title: "Device Management",
            url: "/dashboard/admin/devices",
          },
        ],
      });
    }

    return items;
  }, [ isEmailPasswordUser]);

  // More robust check for user data - ensure we have the user object and it's been fully populated
  const navUserData = !loading && user ? {
    name: user.displayName || user.email?.split('@')[0] || 'User',
    email: user.email || 'No email',
    avatar: user.photoURL || ''
  } : null;

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg text-sidebar-primary-foreground">
                  <Image src="/voltage-meter.png" alt="VoltGuard Logo" width={32} height={32} />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="font-lobster truncate font-semibold">VoltGuard</span>
                  <span className="truncate text-xs">Dashboard</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-4 py-3">
          <div className="mb-2 px-2 text-xs font-medium text-muted-foreground">
            Active Device
          </div>
          <DeviceSelector />
        </div>
        <NavMain items={navMain} />
        {/* <NavProjects projects={data.projects} />
        <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        {navUserData && <NavUser user={navUserData} />}
      </SidebarFooter>
    </Sidebar>
  )
}