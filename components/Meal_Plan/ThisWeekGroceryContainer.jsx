// ThisWeek.js

import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { format, startOfWeek, addDays } from 'date-fns';

const { width } = Dimensions.get('window');

const ThisWeek = () => {
    const router = useRouter();
    const [weekRange, setWeekRange] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date()); // Keep track of the currently selected date

    useEffect(() => {
        // Calculate and set the week range when selectedDate changes
        calculateWeekRange(selectedDate);
    }, [selectedDate]);

    // Utility function to format date to 'YYYY-MM-DD'
    const formatDateKey = (date) => {
        const year = date.getFullYear();
        const month = (`0${date.getMonth() + 1}`).slice(-2);
        const day = (`0${date.getDate()}`).slice(-2);
        return `${year}-${month}-${day}`;
    };

    // Function to calculate the start and end of the week
    const calculateWeekRange = (date) => {
        const firstDayOfWeek = startOfWeek(date, { weekStartsOn: 0 }); // Sunday as first day of the week
        const lastDayOfWeek = addDays(firstDayOfWeek, 6); // Saturday

        const formatDate = (date) => {
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
            const monthName = months[date.getMonth()];
            const dayNumber = date.getDate();
            return `${monthName} ${dayNumber}`;
        };

        setWeekRange(`${formatDate(firstDayOfWeek)} - ${formatDate(lastDayOfWeek)}`);
    };

    // Function to go to the previous week
    const goToPreviousWeek = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 7);
        setSelectedDate(newDate); // Update the selected date to the previous week
    };

    // Function to go to the next week
    const goToNextWeek = () => {
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 7);
        setSelectedDate(newDate); // Update the selected date to the next week
    };

    return (
        <View style={styles.container}>
            <View style={styles.weekNav}>
                {/* Left arrow button */}
                <TouchableOpacity onPress={goToPreviousWeek} style={styles.arrowButton}>
                    <Text style={styles.navText}>{`<`}</Text>
                </TouchableOpacity>

                {/* Week range text */}
                <Text style={[styles.weekRangeText, { fontSize: width > 320 ? 16 : 14 }]} numberOfLines={1}>
                    {weekRange}
                </Text>

                {/* Right arrow button */}
                <TouchableOpacity onPress={goToNextWeek} style={styles.arrowButton}>
                    <Text style={styles.navText}>{`>`}</Text>
                </TouchableOpacity>

                {/* Grocery List button */}
                <TouchableOpacity style={styles.groceryButton} onPress={() => router.push('/GroceryList')}>
                    <Text style={styles.groceryText}>Grocery List</Text>
                </TouchableOpacity>
            </View>
            {/* Additional content for the week can be added here */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        padding: 20,
    },
    weekNav: {
        flexDirection: 'row', // Align items in a row
        justifyContent: 'space-between', // Space between the week range and the button
        alignItems: 'center', // Align items vertically in the center
        padding: 10,
        backgroundColor: '#87CEEB', // Background color for the navigation bar
        borderBottomWidth: 1,
        borderBottomColor: '#ccc', // Bottom border color
    },
    arrowButton: {
        paddingHorizontal: 10, // Add padding to the arrows for better tap area
    },
    navText: {
        fontSize: 18,
        color: '#007bff', // Color for the navigation arrows
    },
    weekRangeText: {
        color: '#000', // Color for the week range text
        textAlign: 'center', // Center the week range text
        flex: 1, // Take up remaining space for proper layout
        paddingHorizontal: 10, // Add padding to ensure the text doesn't touch the edges
    },
    groceryButton: {
        backgroundColor: '#28a745', // Background color for the Grocery List button
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 5, // Rounding corners for the button
        marginLeft: 10, // Space between the week text and button
    },
    groceryText: {
        color: '#ffffff', // Text color for the Grocery List button
        fontSize: 16,
    },
});

export default ThisWeek;
