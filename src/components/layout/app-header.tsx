"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useDevMode } from "@/providers/dev-mode-provider";
import { useAuth } from "@/providers/auth-provider";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Settings, User, LogOut, Moon, Sun } from "lucide-react";

export function AppHeader() {
  const { isDevMode, toggleDevMode } = useDevMode();
  const { user, getCurrentRole, logout } = useAuth();

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="h-4 w-px bg-sidebar-border" />
      </div>
      <div className="flex flex-1 items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <h1 className="font-semibold text-lg">Taskorly RAG Chat</h1>
          <div className="flex items-center space-x-2">
            {isDevMode && (
              <Badge variant="outline" className="text-xs">
                Dev Mode
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs capitalize">
              {getCurrentRole()}
            </Badge>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isDevMode && (
            <Button
              variant="ghost" 
              size="sm"
              onClick={toggleDevMode}
              className="text-xs"
            >
              {isDevMode ? "Exit Dev" : "Dev Mode"}
            </Button>
          )}

          <Button variant="ghost" size="icon">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>{user?.name || "Profile"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <span className="text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}