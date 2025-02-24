#include <SFML/Graphics.hpp>

int main()
{
    // Create a window
    sf::RenderWindow window(sf::VideoMode(800, 600), "SFML");
    window.setPosition(sf::Vector2i(0, 0)); // required for the playground

    sf::CircleShape ball(30.f);
    ball.setFillColor(sf::Color::Red);
    ball.setPosition(0.f, 300.f);

    float speed = 20.f;
    float direction = 1.f;

    sf::Clock clock;

    while (window.isOpen()) {
        sf::Event event;
        while (window.pollEvent(event)) {
            if (event.type == sf::Event::Closed)
                window.close();
        }

        float deltaTime = clock.restart().asSeconds();

        float newX = ball.getPosition().x + direction * speed * deltaTime;

        if (newX <= 0 || newX >= 800 - ball.getRadius() * 2)
            direction *= -1;

        ball.setPosition(newX, ball.getPosition().y);

        window.clear(sf::Color::Black);
        window.draw(ball);
        window.display();
    }

    return 0;
}
