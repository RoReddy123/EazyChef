// App.js

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Header from './../Header';  // Ensure the path to Header component is correct
import Meal from '../../components/Home/Meal';  // Adjust the path as needed
import NutritionTrack from '../../components/Home/NutritionTrack';  // Adjust the path as needed
import NutritionTrackerDay from '../../components/Home/NutritionTrackerDay';

const App = () => {
    const weeklyNutrition = {
        calories: 2000,
        protein: 150,
        sugar: 90,
        fat: 70,
    };

    return (
        <View style={styles.container}>
            <Header title="Dashboard" /> 
            <ScrollView contentContainerStyle={styles.scrollViewContent}>
                <Meal />
                <NutritionTrackerDay />
                <NutritionTrack weeklyNutrition={weeklyNutrition} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F8FF'
    },
    scrollViewContent: {
        flexGrow: 1,
        justifyContent: 'flex-start',
        paddingBottom: 20
    }
});

export default App;
