import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import React from 'react';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarStyle: {
                backgroundColor: '#4682b4', // Set background color of the tab bar
            },
            tabBarActiveTintColor: '#fff', // Set the color of the active tab's icon and label
            tabBarInactiveTintColor: '#d3d3d3', // Set the color of the inactive tab's icon and label
        }}>
            <Tabs.Screen 
                name='Dashboard'
                options={{
                    tabBarLabel: 'Dashboard',
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="dashboard" size={24} color={color} />
                    )
                }}
            />
            <Tabs.Screen 
                name='Explore'
                options={{
                    tabBarLabel: 'Explore',
                    tabBarIcon: ({ color }) => (
                        <MaterialIcons name="explore" size={24} color={color} />
                    )
                }}
            />
            <Tabs.Screen 
                name='MealPlan'
                options={{
                    tabBarLabel: 'Meal Plan',
                    tabBarIcon: ({ color }) => (
                        <FontAwesome5 name="clipboard-list" size={24} color={color} />
                    )
                }}
            />
            <Tabs.Screen 
                name='Recipes'
                options={{
                    tabBarLabel: 'Recipes',
                    tabBarIcon: ({ color }) => (
                        <FontAwesome5 name="utensils" size={24} color={color} />
                    )
                }}
            />
        </Tabs>
    )
}
