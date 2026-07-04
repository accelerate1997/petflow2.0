# 🐾 PetFlow CRM & WhatsApp AI Agent: System Design Document

This document provides a comprehensive technical overview of the **PetFlow** architecture, database schemas, API interfaces, and key transactional flows. PetFlow is a multi-tenant Pet Spa CRM combined with an automated, WhatsApp-powered AI front-desk receptionist.

---

## 1. System Architecture

PetFlow is built as a split-architecture system consisting of a client-facing Next.js CRM Dashboard (monolith/backend APIs) and a decoupled Express.js Node.js service dedicated to executing the WhatsApp AI Agent and background cron schedulers.

```mermaid
graph TD
    %% Clients & Gateways
    PetParent["Pet Parent (WhatsApp)"]
    SalonStaff["Salon Staff (Web Browser)"]
    MobileApp["Staff Mobile Client"]

    %% Webhook & Gateway
    EvolutionAPI["Evolution API Gateway (WA Business)"]

    %% Next.js CRM Component
    subgraph CRM ["Next.js CRM Server (:3000)"]
        CRM_UI["React/Next.js Frontend UI"]
        CRM_API["Next.js App Router APIs"]
        POS_Engine["POS & Invoice Processor"]
        CRM_SocketClient["Socket.io Client"]
    end

    %% Express Agent Component
    subgraph AgentSystem ["Express AI Agent Service (:3002)"]
        Agent_Express["Express Hook Server"]
        OpenAI_GW["OpenAI API Client (GPT-4o-mini)"]
        Cron_Engine["node-cron Automations"]
        Rules_Engine["Booking Rules Engine"]
        Socket_Server["Socket.io Realtime Server"]
    end

    %% Storage Layer
    Database[(PostgreSQL DB via Prisma)]

    %% Connections
    PetParent <-->|WhatsApp Messages| EvolutionAPI
    EvolutionAPI -->|Webhook: messages.upsert| Agent_Express
    Agent_Express -->|Prompt Builder| OpenAI_GW
    OpenAI_GW -->|Tool Calls| Agent_Express
    Agent_Express -->|Send Message API| EvolutionAPI
    EvolutionAPI -->|WhatsApp Message| PetParent

    %% Socket Sync
    Socket_Server <-->|Real-time Socket Rooms| CRM_SocketClient
    CRM_UI <-->|Local React State| CRM_SocketClient

    %% Web CRM Connections
    SalonStaff <-->|HTTPS / React App| CRM_UI
    CRM_UI <-->|REST Calls| CRM_API
    MobileApp <-->|REST Calls / x-tenant-id| CRM_API

    %% DB Connections
    CRM_API <-->|Prisma Client| Database
    Agent_Express <-->|Prisma Client| Database
    Cron_Engine <-->|Prisma Client| Database
```

### Components Summary
1. **Next.js CRM Server**: The dashboard backend and frontend UI. Manages bookings, lodging rooms, visual pipelines, billing checks, Stripe/Razorpay integrations, and outgoing webhooks.
2. **Express AI Agent Service**: Receives WhatsApp event webhooks via the Evolution API, routes them to OpenAI's assistant engine (using tool-calling for DB operations), enforces booking rule checks, and runs background automated retention engines.
3. **Evolution API Gateway**: The bridge hosting WhatsApp web sessions, converting raw WhatsApp socket messages into standard webhook HTTP POST requests and executing text/media sending commands.
4. **PostgreSQL Database**: The shared database using **Prisma ORM** as the unified schema definition provider, maintaining strict multi-tenant constraints using `tenantId`.

---

## 2. Database Schema (Prisma Data Model)

PetFlow enforces strict logical multi-tenancy. Every core business entity points back to a central `Tenant` model via a `tenantId` field.

### Core Schemas & Models

| Model | Description | Major Relationships |
| :--- | :--- | :--- |
| **Tenant** | Represents a salon branch or customer company. | Has many `User`, `Client`, `Pet`, `Service`, `Product`, `Staff`, `Appointment`, `Invoice`, etc. |
| **Client** | Customer profiles containing WhatsApp number, total spend metrics, and contact info. | Belongs to `Tenant`, has many `Pet`, `Sale`, `Invoice`. |
| **Pet** | Registered pet profiles containing species, weight, breed, medical/temperament alerts. | Belongs to `Tenant` & `Client` (owner). Has many `Appointment`, `VaccinationRecord`, `BoardingReservation`. |
| **Service** | Salon services (e.g. Grooming, Bathing) with dynamic duration and size-based tier pricing. | Belongs to `Tenant`. |
| **Product** | Retail inventory items with category details, SKU, pricing, stock levels, and alert thresholds. | Belongs to `Tenant`, has many `Sale` and `StockLog`. |
| **Staff** | Salon workers, roles, and shift details (stored as JSON daily schedules). | Belongs to `Tenant`, has many `Appointment`. |
| **Appointment** | Scheduled pet salon groom sessions with status tracks, payment state, and before/after photos. | Belongs to `Tenant`, `Pet`, `Staff` (groomer), `BoardingReservation`. Has one `Invoice`. |
| **Invoice** | Financial receipts containing subtotal, tax rates, tax amounts, discount percentages/amounts, and payment method details. | Belongs to `Tenant`, `Client`. Has one `Appointment` or `BoardingReservation`. Has many `Sale` and `PaymentLink`. |
| **Sale** | Line items representing retail products sold, connected directly to an invoice. | Belongs to `Tenant`, `Invoice`, `Client`, `Product`, `BoardingReservation`. |
| **Settings** | Salon brand customizer (colors, working hours, currencies, boarding/retail toggles). | Belongs to `Tenant`. |
| **WhatsAppConfig** | API URLs and access tokens for Evolution API instances per tenant. | Belongs to `Tenant`. |
| **ChatSession** | Conversation sessions tracking WhatsApp customer states and active manual takeover flags. | Belongs to `Tenant`, `Client`. Has many `ChatMessage`. |
| **ChatMessage** | Chronological record of chat texts exchanging between client, agent, and tool returns. | Belongs to `ChatSession`. |
| **VaccinationRecord** | Tracks vaccine types (Rabies, DHPP, etc.), date administered, booster due dates, and compliance states. | Belongs to `Pet`. |
| **StockLog** | Audit trail of inventory updates (Sales, Replenishments, Damage/Loss). | Belongs to `Product`. |
| **Campaign** | Bulk WhatsApp broadcast logs, rich media templates, and target segment parameters. | Belongs to `Tenant`. Has many `CampaignLog`. |
| **CampaignLog** | Delivery outcome records per campaign customer (Sent vs Failed). | Belongs to `Campaign`. |
| **PetroConfig** | Fine-grained AI persona parameters, active system instructions, custom knowledge bases, and enabled tool arrays. | Belongs to `Tenant`. |
| **BoardingRoom** | Hotel boarding rooms categorised by size capacities, species filters, and nightly prices. | Belongs to `Tenant`. Has many `BoardingReservation`. |
| **BoardingReservation**| Overnight lodging details, check-in health audits, items checklists, and client signatures. | Belongs to `Tenant`, `BoardingRoom`, `Pet`. Has one `Invoice`. Has many `BoardingCareLog`, `Appointment`, `Sale`. |
| **BoardingCareLog** | Daily logs for boarded pets detailing feeding times, mood, potty, meds, and photos. | Belongs to `BoardingReservation`. |
| **User** | Portal user accounts (SuperAdmin, SpaAdmin, Staff) accessing the React dashboard. | Belongs to `Tenant`. Has many `StaffInvite` (sent). |
| **StaffInvite** | Multi-tenant user invite tokens with strict verification rules and expiry stamps. | Belongs to `Tenant`, belongs to `User` (inviter). |
| **PaymentLink** | Dynamic online payment sessions powered by Stripe or Razorpay API instances. | Belongs to `Tenant`, `Invoice`. |
| **PaymentConfig** | Stripe/Razorpay API integrations config. | Belongs to `Tenant`. |
| **WebhookEndpoint** | Target endpoints and event subscription arrays for third-party integrations (n8n/Zapier). | Belongs to `Tenant`. Has many `WebhookLog`. |
| **WebhookLog** | Transmission status, payloads, and response summaries from outgoing webhook calls. | Belongs to `WebhookEndpoint`. |

---

## 3. Core System Flows

### Flow 1: WhatsApp Webhook & Message Pipeline

Triggers every time a customer sends a message to the salon's WhatsApp number.

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Pet Parent (WhatsApp)
    participant Evo as Evolution API Gateway
    participant Agent as Express AI Agent (:3002)
    participant GPT as OpenAI GPT-4o-mini
    participant DB as PostgreSQL DB

    Parent->>Evo: Sends message ("Hi, is there space for Leo tomorrow?")
    Evo->>Agent: Webhook POST /webhook (payload, apikey headers)
    Note over Agent: 1. Rate Limit Check<br/>2. Duplicate Message De-duplication<br/>3. Bot Loop Checker (suppresses if >10 msgs / 10s)
    Agent-->>Evo: HTTP 200 OK (Acknowledge Webhook)
    
    rect rgb(240, 248, 255)
        Note over Agent: Read Delay Simulation (2s - 4s)
        Agent->>DB: Find active ChatSession for phone
        DB-->>Agent: Returns session details (or null)
        Agent->>DB: Fetch PetroConfig (persona, active tools, custom FAQs)
        DB-->>Agent: Returns config details
    end

    Agent->>GPT: POST chat/completions (System prompt, Chat history, enabled Tools, User input)
    
    alt GPT decides to invoke a tool (e.g. search_client_and_pets)
        GPT-->>Agent: Return tool call: search_client_and_pets({ phone })
        Agent->>DB: Query Client & Pets
        DB-->>Agent: Return records (Client found, Pet: Leo, dog)
        Agent->>GPT: Send Tool Result output back to context
        GPT->>GPT: Parse result & generate final answer
    end

    GPT-->>Agent: Return Final Message ("Hi! Leo is in our files...")
    Note over Agent: Save new ChatMessage (assistant role) in DB
    Agent->>DB: Create ChatMessage
    DB-->>Agent: Saved message entity
    
    par Live Sync to CRM Dashboard
        Agent->>Agent: Emit socket event 'new_message' to CRM Room
    and Send to WhatsApp Client
        Note over Agent: Typing Delay Simulation (55ms per char)
        Agent->>Evo: POST /message/sendText (compositing presence = true)
        Evo->>Parent: WhatsApp Message delivered ✅
    end
```

---

### Flow 2: Self-Service Client & Pet Registration Flow

Executes conversationally when a brand-new phone number interacts with the WhatsApp bot.

```mermaid
stateDiagram-v2
    [*] --> CheckSession : Message Received
    CheckSession --> GreetingNew : search_client_and_pets returns null
    GreetingNew --> AwaitName : Asks: "Could I get your full name?"
    
    AwaitName --> RegisterClient : User provides name
    state RegisterClient {
        [*] --> CreateProfile : Call create_client_profile()
        CreateProfile --> DB_Insert_Client : Insert Client Record
        DB_Insert_Client --> [*]
    }
    
    RegisterClient --> AwaitPetDetails : Asks: "What is your pet's name and species (dog/cat)?"
    AwaitPetDetails --> RegisterPet : User provides pet details
    state RegisterPet {
        [*] --> AddPet : Call add_pet_to_profile()
        AddPet --> DB_Insert_Pet : Insert Pet Record
        DB_Insert_Pet --> [*]
    }
    
    RegisterPet --> PromptService : Profile complete. Greet: "What service would you like for Leo today?"
    PromptService --> [*]
```

---

### Flow 3: Appointment Booking & Scheduling Engine Flow

Ensures all appointments checked by the AI agent or created on the dashboard validate business rules before booking.

```mermaid
graph TD
    A[Start: Request Slot Date & Time] --> B[Calculate Total Duration]
    B -->|Service combination durations| C[Check Working Hours & Shifts]
    
    C -->|Parse requested date day of week| D{Is Groomer/Staff on shift?}
    D -->|No/Off duty| E[Reject: Groomer unavailable on this day]
    D -->|Yes| F{Is time within shift hours?}
    
    F -->|No| G[Reject: Time outside working hours]
    F -->|Yes| H[Check Concurrency Overlaps]
    
    H -->|Query active bookings for groomer| I{Does slot overlap existing booking?}
    I -->|Yes| J[Reject: Groomer already booked at this time]
    I -->|No| K[Check Vaccination Safety]
    
    K -->|Query pet's VaccinationRecord| L{Are key boosters e.g. Rabies overdue?}
    L -->|Yes| M[Create Appointment + Return Booking Warning Alert]
    L -->|No| N[Create Appointment successfully]
    
    E & G & J --> O[Request alternative date/time from client]
```

---

### Flow 4: Pet Boarding & Lodging Flow

Manages overnight pet hotel bookings, capacity checks, daily care logs, and checkout.

```mermaid
sequenceDiagram
    autonumber
    actor Parent as Pet Parent (WhatsApp)
    participant Agent as Express AI Agent
    participant DB as PostgreSQL DB
    actor Staff as Salon Staff (Dashboard)

    Parent->>Agent: Request boarding dates ("I want to board Leo from July 10 to July 15")
    Agent->>DB: Call check_boarding_availability(pet_id, check_in, check_out)
    Note over DB: Queries BoardingRoom list matching pet size tier.<br/>Filters out rooms with active BoardingReservations overlapping requested dates.
    DB-->>Agent: Returns available rooms list with nightly rates & capacities
    Agent->>Parent: Presents options ("Suite A available, total INR 5,000 for 5 nights. Proceed?")
    Parent->>Agent: "Yes, go ahead"
    Agent->>DB: Call create_boarding_reservation(pet_id, room_id, check_in, check_out)
    DB-->>Agent: Reservation created in 'Reserved' status

    Note over Staff: Leo arrives at Salon for Check-in
    Staff->>DB: Execute Check-In audit<br/>(Log weight, inventory of toys/leash, safety warnings & sign digital waiver)
    DB-->>Staff: Status updated to 'CheckedIn'

    loop Daily Stays (Care Logs)
        Staff->>DB: Save care details (Feeding completed, meds administered, potty logs, mood, photo)
        DB->>Parent: Automated WhatsApp dispatch with care report & daily photo
    end

    Staff->>DB: Trigger Checkout stay
    Note over DB: Automatically groups lodging nights + grooming + retail products purchased into a single invoice.
    DB-->>Staff: Combined POS Checkout cart ready
```

---

### Flow 5: Unified POS Cart & Invoice Generation Flow

Handles retail sales, completed appointments, and lodging checks, generating GST-compliant bills and remote payment gateways.

```mermaid
graph TD
    Start[Checkout triggered] --> Cart[Compile Shopping Cart Items]
    Cart --> ServiceItems[Salon Grooming Appointments]
    Cart --> BoardingItems[Lodging Reservation Stays]
    Cart --> RetailItems[Product Catalog Additions]
    
    ServiceItems & BoardingItems & RetailItems --> Discounts{Apply Discounts?}
    Discounts -->|Yes: Percentage or Flat INR| CalculateTax[Calculate GST]
    Discounts -->|No| CalculateTax
    
    CalculateTax -->|Parse items individual GST tiers: 0%, 5%, 12%, 18%| InvoiceTotal[Compile Invoice Total]
    
    InvoiceTotal --> PaymentSelect{Select Payment Method}
    
    PaymentSelect -->|Cash or UPI| RecordImmediate[Save Invoice as 'Paid' status]
    PaymentSelect -->|Remote Payments| GenerateLink[Call Razorpay/Stripe Link Generator]
    
    GenerateLink --> SendLink[Share payment link via WhatsApp / Email]
    SendLink --> GatewayCallback{Payment Webhook received?}
    GatewayCallback -->|Yes: Successful| RecordImmediate
    GatewayCallback -->|No: Expired / Cancelled| VoidInvoice[Mark Invoice as Void / Cancelled]
    
    RecordImmediate --> StockUpdate[Log StockLog & decrement inventory levels]
    StockUpdate --> PrintPDF[Compile PDF A4 Invoice with Salon Logo & Tax Breakdowns]
```

---

### Flow 6: Visual CRM Kanban Board Pipeline

Operates with optimistic rendering to keep salon checkouts and groom state changes responsive.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Salon Staff
    participant UI as React UI (Dashboard)
    participant API as Next.js API Route
    participant DB as PostgreSQL DB
    participant Agent as Express Socket server

    Staff->>UI: Drags pet card from "Checked In" to "In Service"
    Note over UI: Optimistic UI: Card immediately moves on screen.<br/>Spinner indicates background saving.
    UI->>API: PATCH /api/appointments/[id] { status: "InService" }
    
    API->>DB: Update appointment status in database
    DB-->>API: Confirm database updated
    API->>API: Trigger Outgoing Webhooks (Event: appointment.updated)
    API-->>UI: HTTP 200 OK (Update Successful)
    
    Note over UI: Spinner disappears, card transition is completed.
    
    Staff->>UI: Clicks payment pill to change from "Pending" to "UPI"
    UI->>API: PATCH /api/appointments/[id] { payment_status: "UPI" }
    API->>DB: Update database record
    DB-->>API: Confirm database updated
    API-->>UI: HTTP 200 OK (Instant state update)
    
    Note over API: Sync changes to WhatsApp agent view
    API->>Agent: Notify Socket Room: session_updated
    Agent->>UI: Emit event to all connected dashboard screens
```

---

### Flow 7: Automated Marketing & Cron Scheduler Engine

An automated background service that handles client communication, automated followups, and retention without staff intervention.

| Time (Daily) | Flow Name | Cron Pattern | Action / Flow Details |
| :--- | :--- | :--- | :--- |
| **Every Hour** | **2-Hour Appt Reminder** | `0 * * * *` | Finds active appointments scheduled for today in exactly 2 hours. Sends WhatsApp reminder text to owners. |
| **10:00 AM** | **Tomorrow's Reminders** | `0 10 * * *` | Queries appointments scheduled for tomorrow. Dispatches friendly reminder alerts with time and details. |
| **10:00 AM** | **Boarding Checklist** | `0 10 * * *` | Finds lodging stays checking in tomorrow. Dispatches packing lists (food details, meds, vaccine documents request). |
| **11:00 AM** | **6-Week Rebooking Engine** | `0 11 * * *` | Detects clients checked out exactly 6 weeks ago who have no future bookings. Invites them to rebook. |
| **12:00 PM** | **Vaccination Warnings** | `0 12 * * *` | 1. Marks past-due vaccines as `Overdue`. <br/>2. Marks boosters due in <= 14 days as `Due Soon`. <br/>3. Alerts owners with boosters due in exactly 14 days. |
| **6:00 PM** | **Feedback Request** | `0 18 * * *` | Scans checkout appointments completed today. Requests feedback and encourages sharing photo results. |

---

### Flow 8: Targeted Marketing Campaign Broadcasts

Allows salon owners to run target promotions over WhatsApp.

```mermaid
graph LR
    Filter[1. Filter Target Clients: e.g., Dog owners, High Spenders] --> Segment[2. Generate Segment Recipients Array]
    Segment --> Content[3. Compose Campaign Text & Attach Image Media URL]
    Content --> Status[4. Set Campaign status = 'Sending']
    
    Status --> Loop[5. Loop Recipients with 5-second interval delay]
    Loop --> Send[6. Dispatch media / text message via Evolution API]
    
    Send --> Success{Success?}
    Success -->|Yes| LogSuccess[7a. CampaignLog status = 'Sent', increment sentCount]
    Success -->|No| LogFail[7b. CampaignLog status = 'Failed', store error stack, increment failedCount]
    
    LogSuccess & LogFail --> Done{All recipients sent?}
    Done -->|No| Loop
    Done -->|Yes| Finish[8. Set Campaign status = 'Completed']
```

---

### Flow 9: Tenant Staff Invite Flow

Secures credentials creation inside the multi-tenant dashboard environment.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Salon Admin
    participant DB as PostgreSQL DB
    actor Invited as Invited Staff Member

    Admin->>DB: Input email + select role (Staff / SpaAdmin)
    Note over DB: Generates random token (CUID) and sets expires_at to now + 24 Hours
    DB-->>Admin: Saved StaffInvite record
    Note over Admin: Sends secure link: /register?token=[token] via email
    Invited->>DB: Accesses /register?token=[token]
    Note over DB: Validates token exists, used_at is null, and current time < expires_at
    DB-->>Invited: Token Valid. Displays signup form (Name, Password)
    Invited->>DB: Submits Registration details
    Note over DB: 1. Hashes user password<br/>2. Creates User record with tenantId from Invite<br/>3. Marks StaffInvite used_at = now()
    DB-->>Invited: Registration Complete. Logged in to Dashboard.
```

---

### Flow 10: Outgoing Webhook Event System

Dispatches business transactions to client workflows in Zapier, Make.com, or custom endpoints.

```mermaid
graph TD
    Trigger[Groom/Boarding transactional event occurs] --> EventCheck{Are active WebhookEndpoints registered?}
    EventCheck -->|No| EndSession[End]
    EventCheck -->|Yes| GetEndpoints[Retrieve endpoints subscribing to event name]
    
    GetEndpoints --> BuildPayload[Build Event JSON Payload: event, data, timestamp]
    BuildPayload --> SecretCheck{Is HMAC signing secret configured?}
    
    SecretCheck -->|Yes| AddSignature[Compute SHA256 signature & append header x-petflow-signature]
    SecretCheck -->|No| DispatchRequest[Post HTTP payload to target URL]
    AddSignature --> DispatchRequest
    
    DispatchRequest --> ResponseCheck{HTTP response status 2xx?}
    ResponseCheck -->|Yes| SaveLogSuccess[Create WebhookLog: success = true, statusCode, duration]
    ResponseCheck -->|No / Timeout| SaveLogFail[Create WebhookLog: success = false, statusCode, duration, response body]
```

---

## 4. Real-time Live Synchronisation (Socket.io)

Socket.io connects the Express AI Agent and the Next.js CRM Dashboard to ensure customer text exchanges update instantly in the workspace.

*   **Socket Authentication**: Connection handshakes require a valid `PETFLOW_API_KEY` token passed within the headers.
*   **Socket Rooms**: Rooms are keyed by the database `ChatSession` ID.
*   **Synchronisation Lifecycle**:
    1.  **Dashboard Connection**: When a staff member loads the CRM Chats screen, the browser establishes a socket connection and joins the room matching the client's `ChatSession.id` using the socket event `join_session`.
    2.  **AI Message Arrival**: When the Express app processes a WhatsApp message, it writes the result as a new `ChatMessage` and broadcasts it to that specific room via:
        ```javascript
        io.to(session_id).emit('new_message', savedMessage);
        ```
    3.  **Real-time Update**: The dashboard's socket listener catches `new_message` and appends the message object directly to the message state array, giving the staff member instant updates of the conversation.
    4.  **Session Updates**: When the dashboard staff sends a message, they call the Next.js API, which writes to the database, sends the text via Evolution, and triggers `session_updated` via sockets so other open dashboard instances reflect the updated "Last Message" preview.

---

## 5. API Reference Summary

### Next.js CRM Backend API Route Map

*   **Authentication & Invites**:
    *   `POST /api/auth/...` - NextAuth session routes.
    *   `POST /api/webhooks` - Creates and manages webhook integrations.
*   **Mobile App API Hooks**:
    *   `GET /api/mobile/dashboard` - Fetches today's appointments, completed pets counts, and revenue. Requires header `x-tenant-id`.
    *   `POST /api/mobile/login` - Authenticates mobile app staff.
*   **Automation Crons**:
    *   `GET /api/cron/reminders` - Dispatches 2-hour appointment alerts.
    *   `GET /api/cron/boarding` - Sends tomorrow's check-in checklists.
    *   `GET /api/cron/vaccines` - Updates vaccine statuses and sends booster warnings.

### Express AI Agent API Map

*   `POST /webhook` - Receives Evolution API messages (payload contains event type `messages.upsert`).
*   `GET /health` - Health diagnostics showing active session counts and agent uptime.
*   `GET /api/sessions` - Returns list of all active chat sessions.
*   `GET /api/session/info?phone=...` - Queries details of an active memory state.
*   `POST /api/session/clear` - Clears conversation memory for a phone number.
*   `GET /api/petro-config` - Fetches the active configuration.
*   `PUT /api/petro-config` - Saves custom prompt settings and invalidates agent cache.
*   `POST /api/petro-config/chat-preview` - Simulates playground chat to test agent prompts.
