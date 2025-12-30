// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

export default function TabLayout() {
  const { theme, themeType } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const isLight = themeType === 'light';

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
          right: -6,
          top: -3,
          backgroundColor: '#e1306c', // Instagram badge color
          borderRadius: 10,
          minWidth: 16,
          height: 16,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: theme.background,
          zIndex: 10, // 🔥 На всякий случай
        }}>
          <Text style={{
            color: 'white',
            fontSize: 9,
            fontWeight: 'bold',
            paddingHorizontal: 2
          }}>
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: isLight ? theme.border : '#1a1a1a',
          // Optional: Add shadow/elevation for better look
          elevation: 0,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: isLight ? '#2a2a2a' : '#81B29A',
        tabBarInactiveTintColor: isLight ? '#999' : '#666',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, size }) => (
            <TabIconWithBadge name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Поиск',
          tabBarIcon: ({ color, size }) => (
            <TabIconWithBadge name="search" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Чаты',
          tabBarIcon: ({ color, size }) => (
            // 🔥 Badge for Unread Messages
            <TabIconWithBadge name="chatbubble-ellipses" size={size} color={color} badgeCount={unreadMessagesCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Мэтчи',
          tabBarIcon: ({ color, size }) => (
            // 🔥 Badge for New Likes (Matches incoming)
            <TabIconWithBadge name="heart" size={size} color={color} badgeCount={newLikesCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, size }) => (
            <TabIconWithBadge name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}