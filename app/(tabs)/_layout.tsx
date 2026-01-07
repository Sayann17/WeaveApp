// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { useMenu } from '../context/MenuContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';

export default function TabLayout() {
  const { theme, themeType } = useTheme();
  const { unreadMessagesCount, newLikesCount } = useNotifications();
  const { openMenu } = useMenu();
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
          backgroundColor: '#e1306c',
          borderRadius: 10,
          minWidth: 16,
          height: 16,
          justifyContent: 'center',
          alignItems: 'center',
          borderWidth: 1.5,
          borderColor: theme.background,
          zIndex: 10,
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
          elevation: 0,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 30,
          paddingTop: 5,
        },
        tabBarActiveTintColor: isLight ? '#2a2a2a' : '#81B29A',
        tabBarInactiveTintColor: isLight ? '#999' : '#666',
        tabBarIconStyle: { marginBottom: -2 },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 5 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="home" size={28} color={color} />
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Поиск',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="search" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Чаты',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="chatbubble-ellipses" size={28} color={color} badgeCount={unreadMessagesCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: 'Мэтчи',
          tabBarIcon: ({ color }) => (
            <TabIconWithBadge name="heart" size={28} color={color} badgeCount={newLikesCount} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
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