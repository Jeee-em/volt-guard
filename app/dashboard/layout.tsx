"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"

const DashboardLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  const pathname = usePathname();

  const getTitle = (path: string) => {
    const routeMap: Record<string, string> = {
      '/dashboard': 'Overview',
      '/dashboard/analytics': 'Analytics',
      '/dashboard/reports': 'Reports',
    };

    if (routeMap[path]) {
      return routeMap[path];
    }

    const segments = path.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];

    if (!lastSegment || lastSegment === 'dashboard') {
      return 'Overview';
    }

    return lastSegment
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col min-h-screen w-full">
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink href="#">
                        <span className="text-muted-foreground">Dashboard</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>
                        {getTitle(pathname)}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>
            <main className="flex-1 overflow-hidden w-full">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
  )
}

export default DashboardLayout