import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Container, Box, Card, CardContent, Typography, List, ListItem, Button, Grid } from "@mui/material";

function Dashboard() {
  const [data, setData] = useState({ yes: { guests: [], total: 0 }, no: { guests: [], total: 0 }, maybe: { guests: [], total: 0 } });
  const [open, setOpen] = useState({ yes: false, no: false, maybe: false });
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get("http://localhost:5000/rsvp")
      .then((response) => setData(response.data))
      .catch((error) => console.error("Error fetching data:", error));
  }, []);

  const handleToggle = (status) => {
    setOpen((prevOpen) => ({
      ...prevOpen,
      [status]: !prevOpen[status],
    }));
    setExpanded(true);
  };

  const groupByCategory = (guests) => {
    return guests.reduce((acc, guest) => {
      if (!acc[guest.category]) acc[guest.category] = [];
      acc[guest.category].push(guest);
      return acc;
    }, {});
  };

  return (
    <Container maxWidth="lg" sx={{ marginTop: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        RSVP Status Dashboard
      </Typography>

      <Box display="flex" justifyContent="center" gap={2} mb={3}>
        {["yes", "no", "maybe"].map((status) => (
          <Card key={status} sx={{ padding: 2, backgroundColor: getStatusColor(status), color: "white", minWidth: 150 }}>
            <Typography variant="h5">{status.toUpperCase()}</Typography>
            <Typography variant="h6">{data[status].total} Attendees</Typography>
          </Card>
        ))}
      </Box>

      <Box display="flex" justifyContent="space-between" flexWrap="wrap">
        {["yes", "no", "maybe"].map((status) => (
          <Box key={status} sx={{ width: { xs: "100%", sm: "32%" }, marginBottom: 3 }}>
            <Card sx={{ backgroundColor: getStatusColor(status), borderRadius: 2, boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h5" align="center" color="white" gutterBottom>
                  {status.toUpperCase()} ({data[status].total} Attendees)
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => handleToggle(status)}
                >
                  {open[status] ? "Hide Details" : "Show Details"}
                </Button>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>

      {expanded && (
        <Box mt={4}>
          <Typography variant="h4" align="center" gutterBottom>
            Guest Details
          </Typography>
          {["yes", "no", "maybe"].map((status) => {
            if (!open[status]) return null;
            const groupedGuests = groupByCategory(data[status].guests);
            return (
              <Box key={status} mb={4}>
                <Typography variant="h5" sx={{ color: getStatusColor(status), textAlign: "center", mb: 2 }}>
                  {status.toUpperCase()}
                </Typography>
                <Grid container spacing={2} justifyContent="center">
                  {Object.keys(groupedGuests).map((category, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card sx={{ backgroundColor: "#f5f5f5", borderRadius: 2, padding: 2 }}>
                        <Typography variant="h6" align="center" gutterBottom>
                          {category}
                        </Typography>
                        <List>
                          {groupedGuests[category].map((guest, i) => (
                            <ListItem key={i}>
                              <Typography variant="body1">
                                {guest.guestname} ({guest.attendees} Attendees)
                              </Typography>
                            </ListItem>
                          ))}
                        </List>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            );
          })}
        </Box>
      )}

      <Box display="flex" justifyContent="center" mt={4} gap={2}>
        <Button variant="contained" color="primary" onClick={() => navigate("/messagesStatus")}>View Undelivered Messages</Button>
      </Box>
    </Container>
  );
}

function UndeliveredMessages() {
  const [undeliveredGuests, setUndeliveredGuests] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/messagesStatus")
      .then((response) => setUndeliveredGuests(response.data))
      .catch((error) => console.error("Error fetching undelivered data:", error));
  }, []);

  return (
    <Container maxWidth="lg" sx={{ marginTop: 4 }}>
      <Typography variant="h3" align="center" gutterBottom>
        Undelivered Messages
      </Typography>
      <List>
        {undeliveredGuests.map((guest) => (
          <ListItem key={guest.phone}>
            <Typography variant="body1">
              {guest.guestname} (Phone: {guest.phone}, Category: {guest.category})
            </Typography>
          </ListItem>
        ))}
      </List>
      <Box display="flex" justifyContent="center" mt={4}>
        <Button variant="contained" color="secondary" component={Link} to="/">
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case "yes": return "#4caf50";
    case "no": return "#f44336";
    case "maybe": return "#ff9800";
    default: return "#1976d2";
  }
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/messagesStatus" element={<UndeliveredMessages />} />
      </Routes>
    </Router>
  );
}

export default App;