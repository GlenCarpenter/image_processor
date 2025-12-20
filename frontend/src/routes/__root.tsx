import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/mode-toggle'

const RootLayout = () => (
  <SidebarProvider>
    <AppSidebar />
    <main className="w-full">
      <div className="flex items-center justify-between p-4">
        <SidebarTrigger />
        <ModeToggle />
      </div>
      <Outlet />
    </main>
    <TanStackRouterDevtools />
  </SidebarProvider>
)

export const Route = createRootRoute({ component: RootLayout })
