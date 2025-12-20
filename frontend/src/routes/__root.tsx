import { createRootRoute, Outlet, useMatches } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ModeToggle } from '@/components/mode-toggle'

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/':
      return 'Home'
    case '/segment':
      return 'Interactive Segmentation'
    case '/upscale':
      return 'Image Upscaler'
    case '/resize-image':
      return 'Resize Image'
    case '/edit':
      return 'Edit Image'
    case '/history':
      return 'History'
    default:
      return ''
  }
}

const RootLayout = () => {
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname || '/'
  const pageTitle = getPageTitle(currentPath)

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <SidebarTrigger />
          {pageTitle && <h1 className="text-xl font-semibold">{pageTitle}</h1>}
          <ModeToggle />
        </div>
        <Outlet />
      </main>
      <TanStackRouterDevtools />
    </SidebarProvider>
  )
}

export const Route = createRootRoute({ component: RootLayout })
