import { Link } from '@tanstack/react-router'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Home, ImageIcon, Edit } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const menuItems = [
  {
    title: 'Home',
    url: '/' as const,
    icon: Home,
  },
  {
    title: 'Resize Image',
    url: '/resize-image' as const,
    icon: ImageIcon,
  },
  {
    title: 'Edit',
    url: '/edit' as const,
    icon: Edit,
  },
] satisfies Array<{ title: string; url: string; icon: LucideIcon }>

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url} activeProps={{ className: 'bg-accent' }}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
