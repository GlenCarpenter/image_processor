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
import { Home, Expand, Edit, History, Scissors, ArrowBigUpDash } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const menuItems = [
  {
    title: 'Home',
    url: '/' as const,
    icon: Home,
  },
  {
    title: 'Resize',
    url: '/resize-image' as const,
    icon: Expand,
  },
  {
    title: 'Upscale',
    url: '/upscale' as const,
    icon: ArrowBigUpDash,
  },
  {
    title: 'Segment',
    url: '/segment' as const,
    icon: Scissors,
  },
  {
    title: 'Edit',
    url: '/edit' as const,
    icon: Edit,
  },
  {
    title: 'History',
    url: '/history' as const,
    icon: History,
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
