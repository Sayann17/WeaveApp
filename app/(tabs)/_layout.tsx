// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Colors } from '../constants/colors';
import { useMenu } from '../context/MenuContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

export default function TabLayout() {
  const { theme, themeType } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const { openMenu } = useMenu();
  const isLight = themeType === 'light';

  // Use 'ios' as safe default if platform detection is complex for now
  // In a real TMA, we should get this from launch params
  const platform = 'ios';

  // Helper to render icon with optional badge
  const TabIconWithBadge = ({
    name,
    color,
    size,
    badgeCount
  }: {
    name: any,
    color: string,
    size: number,
    badgeCount?: number
  }) => (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badgeCount !== undefined && badgeCount > 0 && (
        <View style={{
          position: 'absolute',
          right: -2,
          top: -2,
          backgroundColor: '#ff4444',
          borderRadius: 5,
          width: 10,
          height: 10,
          borderWidth: 1.5,
          borderColor: theme.background,
          zIndex: 10,
        }} />
      )}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: themeType === 'space' ? Colors.tabBarBackground : theme.background, // Explicit dark BG for Space
          borderTopColor: isLight ? theme.border : 'transparent', // No visible border for Space
          elevation: 0,
          borderTopWidth: isLight ? 1 : 0,
          height: 96,
          paddingBottom: 34,
          paddingTop: 8,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarActiveTintColor: themeType === 'wine' ? '#fbdac9' : (isLight ? '#2a2a2a' : '#81B29A'),
        tabBarInactiveTintColor: isLight ? '#999' : '#666',
        tabBarIconStyle: { marginBottom: -2 },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 5 },
      }}>
      <Tabs.Screen
        name="search"
        options={{
          title: 'Поиск',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="search" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'События',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="calendar" size={28} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="chats"
        options={{
          href: null, // This hides the tab
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Мэтчи',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="heart" size={28} color={color} badgeCount={newLikesCount + unreadMessagesCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="person" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Меню',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="menu" size={28} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            openMenu();
          },
        }}
      />
    </Tabs>
  );
}